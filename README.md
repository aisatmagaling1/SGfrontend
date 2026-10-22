# Request Hub (Phase 2: forms, approvals, leave balances, live updates)

Employee requests and approvals for Steniel Graham Packaging Philippines Corporation.

## Run it
1. Install Node.js 18 or newer.
2. In this folder run `npm install` (Phase 2 adds `socket.io`, so run it again if you already did).
3. Copy `.env.example` to `.env` and fill in:
   - `MONGODB_URI` from MongoDB Atlas
   - `JWT_SECRET`: run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the result
   - `SEED_HR_EMAIL` and `SEED_HR_PASSWORD` for the first HR account
4. First time only: `npm run seed` creates the first HR account.
5. `npm start`, then open http://localhost:4000

Accounts made in Phase 1 get their starting leave balances automatically the first time the server starts.

## What is new in Phase 2
- 10 forms from one shared template (File a request on the dashboard).
- Approval chain: supervisor, then manager, then HR. A step is skipped when nobody is assigned; each step unlocks only after the one before it.
- Reject needs a reason and ends the request. The requester can cancel while it is pending.
- Request page with stamp (APPROVED / NOT APPROVED / CANCELLED), approval chain, remarks and history.
- Sick and Vacation leave: 5 days each by default, deducted on final approval, editable by HR on the Users page. Unused days carry over: on January 1 the yearly 5 days are added to what is left.
- Audit log (MongoDB collection `auditlogs`) of submits, approvals, rejections, cancellations, account and balance changes.
- Live updates over Socket.IO: requests, approvals queue, dashboard and HR's waiting-accounts list update without reloading. If the connection drops, a "Reconnecting" note appears and the page checks every 5 seconds until it returns.

## Test checklist
Make four accounts (sign up, then approve them as HR): a supervisor, a manager and two employees. On the Users page assign the employee a supervisor and a manager.
1. As the employee, file a Sick leave request for 2 days. The request page should show the chain: Supervisor waiting, Manager waiting, HR waiting.
2. Open a second browser (or private window) as the supervisor. The request should appear in Approvals without reloading. Approve it. In the employee's window the status should change by itself.
3. Approve as manager, then as HR. The stamp becomes APPROVED, and on the Users page the employee's Sick days drop by 2.
4. File another request and reject it as the supervisor. A reason is required. The request ends and the other steps close.
5. File a request and cancel it as the employee while pending.
6. Try a leave request longer than the balance. It should be refused with the days available.
7. As the second employee with no supervisor assigned, file an Undertime request: the supervisor step shows "Skipped".
8. Try to open another person's request link: you should see "Request not found".
9. Stop the server while a page is open: the "Reconnecting" note appears. Start it again and the note disappears.
10. File every form type once and check the numbers (days, hours) are right.

## Good to know
- Leave days are counted as calendar days, first and last day included (weekends too).
- Only employee, supervisor, manager and HR can file requests. Accounting can view everything but cannot file or approve.
- HR can file requests too, but another HR must approve them (nobody approves their own). With only one HR account, an HR request will wait.
- Live updates only say "something changed"; each page then loads its data from the normal API, so nobody receives information they may not see.
