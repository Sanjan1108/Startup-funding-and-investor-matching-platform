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

## Verification SQL
```sql
USE startup_funding_platform;
SHOW TABLES;
SELECT COUNT(*) FROM `user`;
SELECT COUNT(*) FROM startup;
SELECT COUNT(*) FROM investor;
SELECT * FROM match_result ORDER BY match_score DESC;
SELECT * FROM startup_funding_summary;
SHOW TRIGGERS;
SHOW PROCEDURE STATUS WHERE Db='startup_funding_platform';
SHOW FUNCTION STATUS WHERE Db='startup_funding_platform';
```
## MongoDB verification
```javascript
use startup_funding_nosql
db.pitch_deck_content.find().limit(5)
db.activity_logs.find().sort({createdAt:-1}).limit(5)
```
