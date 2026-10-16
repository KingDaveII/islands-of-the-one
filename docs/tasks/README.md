# Engine task prompts

MAIN's task prompts for Claude Code, one file per task (`g15f.md`, …), like ART's art jobs in `art/jobs/`.

- MAIN commits each prompt as the first commit of the task's own branch. The session checks out that branch and works from the file, so a change to the brief is an edit here and the PR shows the brief next to the work.
- A session re-reads its task file before it declares the task done, and after any context compaction.
- The Game Design Book's Engineering tab lists the tasks and links here. Prompts from before G1.5f live only in the book.
