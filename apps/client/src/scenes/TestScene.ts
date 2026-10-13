import Phaser from 'phaser';
import { resolveServerUrl } from '../config.js';
import { connect, type Connection } from '../net.js';
import { Palette } from '../palette.js';
import { body, label, preloadFonts, registerFonts, type Text } from '../render/text.js';

const SELF_COLOR = Palette.spark;
const OTHER_COLOR = Palette.floorEdge;

/** M0 smoke-test scene: connect to the test room, show peers, click to move. */
export class TestScene extends Phaser.Scene {
  private status!: Text;
  private connection: Connection | undefined;
  private readonly markers = new Map<string, Phaser.GameObjects.Arc>();
  private lastRtt: number | undefined;

  constructor() {
    super('TestScene');
  }

  preload(): void {
    preloadFonts(this);
  }

  create(): void {
    registerFonts(this);
    label(this, 16, 16, 'ISLANDS OF THE ONE — M0 TEST SCENE', Palette.uiInk, 16).setScrollFactor(0);
    this.status = body(this, 16, 44, 'connecting…', Palette.uiInkMuted);

    const url = resolveServerUrl(
      import.meta.env.VITE_SERVER_URL,
      window.location,
      import.meta.env.PROD,
    );
    connect(url)
      .then((conn) => {
        this.connection = conn;
        conn.onPong((rtt) => {
          this.lastRtt = rtt;
        });
        conn.onClose((code) => {
          this.connection = undefined;
          this.status.setText(`disconnected (code ${code})`);
        });
        this.time.addEvent({
          delay: 1000,
          loop: true,
          callback: () => {
            conn.ping();
          },
        });
        conn.ping();
      })
      .catch((err: unknown) => {
        this.status.setText(
          `connection failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.connection?.move({ x: pointer.worldX, y: pointer.worldY });
    });
  }

  override update(): void {
    const conn = this.connection;
    if (!conn) return;

    const players = conn.players();
    if (!players) return;
    players.forEach((player, id) => {
      let marker = this.markers.get(id);
      if (!marker) {
        const color = id === conn.sessionId ? SELF_COLOR : OTHER_COLOR;
        marker = this.add.circle(player.x, player.y, 12, color);
        this.markers.set(id, marker);
      }
      marker.setPosition(
        Phaser.Math.Linear(marker.x, player.x, 0.25),
        Phaser.Math.Linear(marker.y, player.y, 0.25),
      );
    });
    for (const [id, marker] of this.markers) {
      if (!players.has(id)) {
        marker.destroy();
        this.markers.delete(id);
      }
    }

    const rtt = this.lastRtt === undefined ? '…' : `${Math.round(this.lastRtt)} ms`;
    this.status.setText(
      `connected as ${conn.sessionId} · players: ${players.size} · rtt: ${rtt} · click to move`,
    );
  }
}
