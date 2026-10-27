# Changelog

What changed in the application, for someone who reads no spec. One entry per piece of work that reaches the base branch, written by the work's last commit; never edited afterwards. Newest day first, newest entry first under its day. Format: `- {Added|Changed|Fixed} — {one or two sentences from the user's side: what they can now see or do}.`, then ` ([blueprint](blueprints/{file}))` for a blueprint's work.

## 2026-10-27

- Fixed — In the files window's explorer, the selected file now reads as a softly tinted row, instead of a thin bar that curved into a crescent on its left edge.
- Changed — A session's « Fichiers modifiés » now shows each file's status and lines added and removed, and opens the files in a window of their own, like an editor: an explorer with a filter on the left, tabs and the diff on the right, its lines numbered, unified or side by side, with a bar to jump between its commits.
- Changed — In a session's « Déroulé du tour », the same step repeated in a row now reads as one line, with a pip per pass and its total time; a chevron unfolds the passes, and the subagents sit indented under the step they started in.
- Added — In the sessions list, a session working in a worktree shows a small fir tree; hovering or tapping it gives the worktree's name, its branch and its folder, and the search also finds a session by its worktree's name.
