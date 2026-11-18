# Manual Test Cases – Record Actual Results Before Submission

These are test procedures and expected outcomes, not claimed execution results. Run locally and fill in actual results/evidence.

| ID | Test | Procedure | Expected outcome | Actual result / evidence |
|---|---|---|---|---|
| TC-01 | Registration | Register with valid details | Account created; password hashed | Pending |
| TC-02 | Validation | Submit missing required fields | Request rejected with validation message | Pending |
| TC-03 | Duplicate email | Register same email twice | Duplicate rejected | Pending |
| TC-04 | Login | Login with valid credentials | Session cookie issued | Pending |
| TC-05 | Authentication | Call protected API logged out | HTTP 401 | Pending |
| TC-06 | Startup | Add startup with valid industry | Row appears in MySQL/UI | Pending |
| TC-07 | Investor | Add investor profile | Investor appears in list | Pending |
| TC-08 | Preferences | Save industry/stage/ticket range | Preferences persist | Pending |
| TC-09 | Matching | Run matching with sample records | Scores 0–100 saved | Pending |
| TC-10 | Ranking | Open matches | Highest score first | Pending |
| TC-11 | Funding | Create valid funding round | Round saved | Pending |
| TC-12 | Investment | Add positive investment | Investment saved; totals update | Pending |
| TC-13 | Meetings | Add meeting | Meeting appears in list | Pending |
| TC-14 | Pitch deck | Add deck metadata and text | MySQL metadata + MongoDB document | Pending |
| TC-15 | Search | Search a term in pitch text | Relevant deck returned | Pending |
| TC-16 | Health | Call `/api/health` with both DBs running | Connected response | Pending |
| TC-17 | Integrity | Insert invalid foreign key | MySQL rejects row | Pending |
| TC-18 | Advanced SQL | Run view/procedure/function/trigger/transaction examples | Objects execute as intended | Pending |
| TC-19 | Negotiation Initiation | Submit term sheet proposal from Matches or Negotiations page | Negotiation row created in MySQL with status PROPOSED and event logged to MongoDB thread | Pending |
| TC-20 | Counter-Offer | Submit counter-offer modifying amount/equity | Status updates to COUNTER_OFFERED, round increments, event appended to MongoDB timeline | Pending |
| TC-21 | Deal Acceptance & Transaction | Accept agreed deal terms | MySQL transaction marks status ACCEPTED and automatically creates row in `investment` table | Pending |
| TC-22 | Trigger Validation | Submit offer exceeding funding round requirement | MySQL trigger `check_negotiation_before_insert` rejects row with error signal | Pending |
| TC-23 | Round Auto-Close Trigger | Invest remaining capital required for a round | Trigger `update_round_status_after_investment` automatically transitions round to `CLOSED` | Pending |
| TC-24 | Closed Round Protection | Attempt to invest into a closed funding round | Trigger `check_investment_amount_and_status` rejects insert | Pending |
| TC-25 | Equity Cap Trigger | Attempt to allocate investment equity exceeding 100% | Trigger `check_investment_amount_and_status` rejects insert | Pending |
| TC-26 | Negotiation Audit Trigger | Submit a counter-offer or update negotiation terms | Trigger `log_negotiation_audit_after_update` writes old/new terms into `negotiation_audit` | Pending |
| TC-27 | Round Capital Protection | Attempt to reduce round requirement below committed capital | Trigger `prevent_closed_round_funding_reduction` rejects update | Pending |
| TC-28 | Role-Specific Dashboards | Sign in as STARTUP vs INVESTOR account | STARTUP sees Founder Dashboard (capital raised, open rounds, live negotiations); INVESTOR sees Portfolio Dashboard (deployed capital, holdings, deal flow matches) | Pending |

## Verification SQL
```sql
USE startup_funding_platform;
SHOW TABLES;
SELECT COUNT(*) FROM `user`;
SELECT COUNT(*) FROM startup;
SELECT COUNT(*) FROM investor;
SELECT * FROM match_result ORDER BY match_score DESC;
SELECT * FROM negotiation;
SELECT * FROM negotiation_summary;
SELECT * FROM negotiation_audit;
SELECT * FROM startup_funding_summary;
SHOW TRIGGERS;
SHOW PROCEDURE STATUS WHERE Db='startup_funding_platform';
SHOW FUNCTION STATUS WHERE Db='startup_funding_platform';
```
## MongoDB verification
```javascript
use startup_funding_nosql
db.pitch_deck_content.find().limit(5)
db.negotiation_threads.find().limit(5)
db.activity_logs.find().sort({createdAt:-1}).limit(5)
```
