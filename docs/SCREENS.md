# Screens

Low-fidelity descriptions only. Colors, type and components follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). "A-" screens are desktop first and use AdminLayout. "M-" screens are mobile first (360 to 430 px) and use MobileLayout.

## Layout shells

**AdminLayout (desktop first)**
```
+-----------+---------------------------------------------+
| DRRMO     |  Page title            [search] [user menu] |
|           +---------------------------------------------+
| Dashboard |                                             |
| Events    |   Wide content: tables, map, side panels    |
| People    |                                             |
| Map       |                                             |
| Reports   |                                             |
| Memos     |                                             |
| Messages  |                                             |
| Access    |                                             |
| Records   |                                             |
+-----------+---------------------------------------------+
```
Below 1024 px the sidebar collapses to icons. Below 768 px it becomes a top menu and tables become stacked cards (read focused).

**MobileLayout (mobile first)**
```
+---------------------------+
| DRRMO        [bell][me]   |
| [On duty banner if any]   |
|                           |
|   One main action         |
|   Short list or form      |
|                           |
+---------------------------+
| Duties | Memos | Msgs | Me|
+---------------------------+
```
Tap targets at least 48 px. Base font 16 px, high contrast for outdoor use. On screens wider than 768 px the content sits in a centered 640 px column.

**Sign out button (both layouts)**
One tap starts one sign out. The label changes to "Signing out..." and the button is disabled until the server answers, so a double tap or a slow network cannot send it twice. On success the person lands on the sign in screen and every other open tab follows. If the server cannot be reached or fails, the person stays signed in and sees "Could not sign out. Try again."

---

## Admin screens (desktop first)

| Screen | Role | Desktop layout | Phone fallback |
|---|---|---|---|
| A-Dashboard | Admin | Three cards across the top: Today's events, Unacknowledged assignments, Overdue reports. Below: table of today's shifts with live status. | Cards stacked, read only |
| A-Access requests | Admin | Table of volunteer sign up requests with name, email, requested time and status. Filter buttons: Waiting for review (default), Email not confirmed, Rejected, Approved, All. Approve button per waiting row. Reject opens a dialog that needs a reason. | Table scrolls sideways |
| A-People list | Admin | Table with filters (role, team, status, department), search, bulk actions (activate, deactivate, export). Import CSV button. | Card list, search only |
| A-Person profile | Admin | Left: details and edit form. Right: tabs for assignments, status history, emergency contacts, grants. Volunteer switch with reason dialog. | Details only |
| A-Volunteer toggle | Admin | Part of People list and profile, not a separate page. Switch plus reason dialog. | Same dialog |
| A-Events list | Admin | Table with date range, status and location filters. Calendar toggle (month view). | List by date |
| A-Event detail | Admin | Header with event info and status. Requirements table with headcount progress bars (assigned and acknowledged). Buttons: add requirement, publish, cancel. | Read only summary |
| A-Assignment editor | Admin | Side panel over the event page. Candidate table with checkboxes, team, status and warning chips. Over-headcount reason dialog. | Not supported, message shown |
| A-Live map | Admin, granted users | Map takes 70% width. Right panel: event filter, list of on-duty people with last seen time, "No ping 5+ min" and "No location" groups. Layer toggle Satellite and Streets. "Approximate, not real time" label. | Full-screen map, list in a bottom sheet |
| A-Report feed | Admin, granted users | Filters on top (event, location, date). Newest first list of report cards with summary, time, author, photo thumbnail, late or overdue badge. | Same cards, one column |
| A-Memo manager | Admin | Table of memos with category and date. Editor: title, category, body or file upload. | List only |
| A-Roles | Admin | Access control group in the sidebar. Table of roles: name and description, people count, a bar for how many admin permissions it holds, Built-in or Custom chip. Buttons: Permission matrix, New role (name, description, start from the basics or a copy). | Tappable list |
| A-Role detail | Admin | Header with name, chips and description. Edit details and Delete for custom roles. Permissions tab: switches grouped by module, each with a plain description. Locked switches show a lock and why. Turn all on per group. A sticky save bar with the change count. People tab: who holds the role, and an Add people dialog that moves people in. | Same, one column |
| A-Permission matrix | Admin | Permissions (rows, grouped) by roles (columns) with tick boxes. Find a permission box and a legend. Changed boxes turn amber until saved. Locked boxes show a lock and the reason on hover. One sticky save bar saves every role at once. | Scrolls sideways with the permission column pinned |
| A-Temporary access | Admin | Table of grants with Active, Upcoming, Ended and All tabs. Give access dialog: person, permission, event (optional or required), start, end, reason. End access button. | Table scrolls sideways |
| A-Audit log | Admin | Table with filters (actor, action, entity, date). Row expands to show before and after JSON. | List only |
| A-Notification log | Admin | Table: recipient, type, status, attempts, time, error. Retry button on failed rows. Daily send count against the provider limit. | List only |
| A-DRRMO inbox | Admin | Two panes: conversations on the left, messages on the right. | One pane at a time |

## Mobile screens (mobile first)

| Screen | Role | Phone layout | Desktop |
|---|---|---|---|
| M-Login | Everyone | Maroon header with the ZPPSU and DRRMO logos, office names and system name. White sheet below with email, password (show and hide), big Sign in button, a "Forgot your password?" link, a Request access link, a message box that explains why a correct password still cannot sign in (email not confirmed with a link to the code screen, waiting for approval, not approved, disabled), and a data privacy note. | Two columns: brand panel left, form right |
| M-Request access | Everyone | Same frame as M-Login. First name, Last name, email, password and Confirm password (12 characters at least), a privacy notice checkbox and a Request access button. Link back to sign in. | Same as M-Login |
| M-Confirm email | Everyone | Same frame as M-Login. A big 6 digit code field, Confirm email button, and a Send a new code button that waits 60 seconds. Explains the code works for 10 minutes. After 5 wrong tries the field locks until a new code is sent. Send a new code always answers on screen: the button shows a spinner and "Sending..." and is disabled while it runs, then a green note says "We sent a new code to <email>. It may take a minute.", then the button counts down "Send a new code in 60s" (the first minute is already counting when the screen opens). A 429 shows "Please wait a minute before asking again." and uses Retry-After when sent. Any other failure shows "Could not send a new code. Try again." Old messages clear when a new action starts. | Same as M-Login |
| M-Waiting for approval | Everyone | Same frame as M-Login. Says the email is confirmed and the office will review the request, and that an email follows. Back to sign in link. | Same as M-Login |
| M-Forgot password | Everyone | Same frame as M-Login. Email field and a Send reset link button. After sending, a success note that never says whether the email has an account, and that the link works for 60 minutes. Back to sign in link. | Same as M-Login |
| M-Reset password | Anyone with a link | Same frame as M-Login. Opened from the email. New password (at least 12 characters, with a hint) and Type it again, then Save new password. Afterwards a note that every device was signed out and a link to sign in. A broken or old link shows a short error and a link to ask for a new one. | Same as M-Login |
| M-Cookie notice | Everyone, no sign in | Public page at /cookies in plain short sentences, in a plain document layout (slim top bar with the logos, one reading column). Lists each cookie with its name, what it does, how long it is kept and when it is set (a table on desktop, stacked rows on phones), says all of them are essential and the system does not work without them, says there is no tracking, advertising or analytics and no cookie choice to make, mentions the Data Privacy Act of 2012 and who to ask. Back to sign in link. | Same, one column |
| M-Cookie banner | Everyone, first visit | A short message with a Got it button and a Read the cookie notice link. A bar fixed to the bottom on phones, a floating card at the bottom right on desktop. It does not block the page or trap focus, is not shown on /cookies, and is remembered in local storage (not a cookie). A Cookie notice link also sits in the footer of every signed out screen. | Same |
| M-Privacy notice and consent | Everyone | Scrollable notice, plain language summary at top, "I agree" button fixed at bottom. | Centered column |
| M-Location consent | Marshal, Volunteer | Short text with three bullets (when, who sees it, how long kept), Agree and Not now buttons. | Centered column |
| M-My assignments | Marshal, Volunteer | Tabs Today and Upcoming. Each card: event, time, place, duty type, status chip. Current or next shift pinned on top with its main button (Acknowledge or Start duty). | Two-column cards |
| M-Assignment detail | Marshal, Volunteer | Event and shift info, instructions, small location map, one main button that changes with state: Acknowledge, Start duty, End duty. On duty banner at top. | Wider column |
| M-Report slots and form | Designated reporter | List of slots for today with due time and status. Form: summary text area (with character count), Add photo button (opens camera), Submit. Draft saved automatically. | Wider column |
| M-Event notices | Coordinator | List of upcoming events for their department or campus wide. Read only. | Two-column cards |
| M-Memo search | Everyone | Search box at top, category chips, results list with title, category, date, file size. | Results in two columns |
| M-Memo viewer | Everyone | Title, date, body text, or Open file button. | Same, wider |
| M-Messages | Everyone | Conversation with DRRMO, newest at bottom, text box and Send button. Simple, no attachments in v1. | Two panes |
| M-My access | Everyone | Your role with its description, what it lets you do (Everyday and Office screens), any extra access with its end time, and a link to the office screens when the person has some. Read only. | Wider column |
| M-My profile | Everyone | Name, role, team, department (read only), contact number (editable), emergency contacts list with add, edit, delete, "Download my data", "Stop location consent", Logout. | Wider column |

## States every screen needs

- Loading: skeleton rows, never a blank page.
- Empty: one sentence and, where it makes sense, the next action ("No duties yet. DRRMO will email you when you are assigned.").
- Error: plain message and Retry.
- Offline: a thin grey bar "You're offline. Changes will be sent when you reconnect." on mobile screens.
