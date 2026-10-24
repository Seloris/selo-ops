# App

The shell of Selo Ops: its address, its header, its theme, its language. The interface is in French.

## Functional requirements

- **FR-01** — The home address (`/`) opens « Sessions live », with no path to add.
- **FR-02** — The header offers a Clair / Sombre theme switch, Sombre by default, remembered in the browser.
- **FR-03** — Every page shows the same header: the « SELO OPS » wordmark, the tabs « Live » (Sessions live, the default view), « Projets » and « Debug », « Aide », which opens the help in a popup (`help` FR-10), and the theme switch; the current page's tab is highlighted (on the help page, « Aide » is its highlighted link), « Projets » opens the projects page, and « Debug » is dimmed, marked « Bientôt » and leads nowhere until its page exists.
- **FR-04** — A page spec, a domain sheet (the `app` sheet with them) and a blueprint each wear one colour and one icon, the same wherever one shows (the projects page, the help's « Specs » tab): page indigo with a window, domain sheet pink with a book, blueprint teal (the blueprint lane's colour) with a plan.
- **FR-05** — A bell in the header, beside the theme switch, opens a small panel to choose the states that notify: « Attend ta réponse », « Attend ta permission », « Commit à valider » and « Arrêtée » (those « à traiter », `session` BR-04), then « Tour terminé » and « Job done », none checked by default, the choice remembered in the browser; checking the first one asks the browser's permission, and a refused permission shows « Notifications bloquées par le navigateur » in the panel instead of the states; the bell shows the count of states that notify in a small badge, and is struck through while none does, and left out where the browser has no notifications. Whatever the page and while the app is open, even in the background, an open session that enters a checked state, or moves from one to another, raises a browser notification naming its state and its project, with its request; the sessions already in a checked state when the app opens or when the choice changes raise none, nor does a session while the app's window has the focus; a click on the notification brings the app to the front on the session's detail (`sessions-live` FR-18).
- **FR-06** — The browser can install Selo Ops as an app of its own, named « Selo Ops », opening on « Sessions live » in its own window with the app's icon.

Retired:
