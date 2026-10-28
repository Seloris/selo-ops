-- `question` BR-03: « Résume » is no preset any more; the questions asked with it go.
DELETE FROM "questions" WHERE "preset" = 'summary';
