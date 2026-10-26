# Data Reconciliation Studio: handover

Last updated: 26 Oct 2026

## 1. What it is

A single HTML file that compares two Excel or CSV files and reports:

- which records match, which are missing from each side, and which are duplicated
- how the columns of the two files correspond (column mapping), with confidence and a reason
- which values disagree, which are placeholders ("Other"), which are garbled text, and which are blank
- how accurate the automatic mapping is against a list of mappings you have confirmed
- a colour-coded Excel report with one tab per analysis

Everything runs in the browser. No file is uploaded anywhere.

## 2. Files

| File | Purpose |
|---|---|
| `Reconciliation_Studio.html` | The dashboard. Open in Chrome or Edge. Needs internet on first open (loads three libraries from cdnjs). |
| `Sample_Reconciliation_Report.xlsx` | Report generated from your client file and the original database, using your confirmed mappings. Includes the Mapping Check sheet. |
| `source/engine.js` | Matching and analysis engine (pure JavaScript, no DOM). This is where the logic lives. |
| `source/app_template.html` | Dashboard UI source (HTML, CSS, JavaScript). `engine.js` is inlined into it at build time. |
| `source/build.py` | Rebuilds `Reconciliation_Studio.html` from the two source files. |
| `source/tests/e2e_v2.js` | Runs the real dashboard in a headless browser DOM with real files and confirmed mappings, then builds the report. |
| `source/tests/test_v2.js` | Engine-only test: automatic mapping graded against confirmed mappings. |
| `source/tests/metrics.js` | Duplicate-key handling and per-column data error rate. |
| `source/tests/run_all.sh` | Runs all scenarios and writes `results.txt`. |
| `source/tests/export_json.py` | Converts two Excel files to the JSON used by `test_v2.js` and `metrics.js`. |
| `source/tests/confirmed_orig.txt`, `confirmed_renamed.txt` | Your confirmed mappings for the two data sets. |
| `source/tests/results.txt` | Latest test output. |

Paths in `run_all.sh` point at the sandbox folders. Change them to your own before running.

## 3. How to use it

1. Open `Reconciliation_Studio.html`.
2. Drop the source file (for example the client extract) into File A, and the compare file (for example the user database) into File B.
3. Click **Analyze & map columns**.
4. Read the **Column mapping** tab. Statuses:
   - **Auto-matched**: values agree well (85% or more) on matched records.
   - **Review**: values agree partly (50 to 85%), or there are too few values to check.
   - **Confirm (close alternative)**: another source column scored almost as high. Decide, then lock it.
   - **Known pair**: you confirmed this mapping.
   - **Low confidence**: values barely agree. Not auto-mapped; choose it yourself if needed.
5. In **Confirmed mappings**, enter one line per pair, for example `Designation = Assignment Name`, or `OfficeName = (none)` for columns that should stay unmapped. Click **Apply confirmed mappings**. The Overview then shows how accurate the automatic result was against your list, and the locked result is used for the report.
6. **Save mapping profile** downloads a JSON file with your confirmed mappings. **Load profile** restores them on the next run with the same files.
7. **Download report** produces the Excel file.

## 4. How the engine works

### 4.1 Pipeline

1. **Prepare**: clean headers, detect each column's kind (email, phone, name, date, text), and compute the value-type profile of every column.
2. **Find the key**: test every pair of columns. A key must be nearly unique in both files (at least 95% distinct), and at least 30% of its values must appear in the other file. The highest-scoring pair wins.
3. **Find key aliases**: any other compare column that holds the same key values (at least 98% identical) is treated as an alias of the key, not as a data column. Example: `Email` in your database is an alias of `UserName`.
4. **Join**: match source rows to compare rows by normalised key. If a key appears more than once in the compare file, use the most complete row (an active row gets priority).
5. **Match columns** (staged; see 4.2).
6. **Analyse**: compare each matched pair of values, count issues, build insights, and compute the error rates.

### 4.2 Column matching, staged

This follows the order you asked for.

- **Stage 0, known pairs.** If you confirmed a pair, it is locked (confidence 1.0) and skips the other stages.
- **Stage 1, name.** Exact name, then synonym group (for example Gender and Person Gender), then shared words (partial or half match), then spelling similarity. Generic words such as "name" and "number" do not count as evidence on their own.
- **Derived columns.** A derived column (First + Last) is dropped when a real column with the same meaning exists.
- **Stage 2, value type.** Compares the type of values in the whole column (number, phone, date, email, text, GUID), not the values themselves. Two columns whose types differ are rejected unless the names match exactly.
- **Stage 3, sampled check on matched records.** First 10 pairs. If they are similar, last 10 and 10 random pairs are added. Two checks run here: value type agreement (rejected below 50%) and value similarity (rejected below 15% on the first 10 unless the name is a strong match).
- **Stage 4, full value similarity.** Across all matched pairs, punctuation and spacing are ignored, phone numbers are compared on their last nine digits, and names ignore titles such as "Md." and "Mr".
- **Score.** `confidence = 0.35 × name + 0.65 × value similarity`, reduced when types only partly agree and when one side is derived.
- **Assignment.** One-to-one, highest confidence first. Columns whose values are less than 30% similar are never auto-mapped.
- **Ambiguity.** If another source column is within 0.10 of the chosen one, the pair is flagged "Confirm". An exact name match is never flagged.

### 4.3 Error metrics

- **Mapping accuracy**: the share of your confirmed pairs that the automatic result gets right. Pairs you confirmed as "(none)" count as correct when the studio leaves them unmapped.
- **Mapping error rate**: 1 minus accuracy, counting wrong and missed pairs. Extra mappings that are not on your list count as wrong.
- **Data error rate**: among cells where both files have a value, the share that really disagree (value conflicts plus garbled text). Exact matches, formatting-only differences, and blanks are not errors.

These error rates are only as good as the confirmed list they are compared against.

## 5. Results

Source: Basic_Employee_Extract (1,350 rows) against user_information_database (1,769 rows) and its renamed copy. Full output in `source/tests/results.txt`.

### 5.1 Mapping

| Data set | Automatic result | Automatic mapping error | After you confirm |
|---|---|---|---|
| Original database | 6 of 7 confirmed pairs right | **14.3%**. Wrong: `Designation → Job` (should be `Assignment Name`). | 0% |
| Renamed database | 8 of 8 confirmed pairs right | **0%** | 0% |

Original database detail: Email (alias), FullName, Gender, PhoneNumber, CountryName, OfficeName (correctly left unmapped) were all right.

### 5.2 Data error rate after the correct mapping (original database)

Overall: **15.3%** of filled cells really disagree (868 of 5,673).

| Column | Disagreeing cells | Rate | Main cause |
|---|---|---|---|
| Designation ↔ Assignment Name | 656 of 1,249 | **52.5%** | Designation often equals Job, not Assignment Name. 55 garbled values. |
| Gender ↔ Person Gender | 149 of 1,191 | **12.5%** | 148 database values are "Other" where the source has Male or Female. |
| FullName ↔ First + Last | 30 of 1,283 | 2.3% | Titles and spelling. 8 garbled values. |
| PhoneNumber ↔ Mobile Number | 26 of 1,255 | 2.1% | Different numbers. |
| CountryName ↔ Country | 7 of 695 | 1.0% | Few real conflicts. Most issue is 588 blank database values, which are not counted here. |

Renamed database: overall data error rate 11.4%.

### 5.3 Records

- 1,283 source records matched by email. 67 source records are missing from the database. 483 database rows are not in the source; 439 of them are marked active.
- 4 duplicate keys in the database. For each, the most complete row was used. The three duplicates that are in the source used rows 355, 1345, and 1362. The fourth (`jeanbaptiste.muhindo@`) is not in the source.

### 5.4 Notes on the earlier report

`Reconciliation_Report_2026-10-26.xlsx`, which you uploaded, is the automatic run before this version. It maps `Designation → Job`, so its conflict counts (1,253 value conflicts) are inflated by the wrong mapping. Re-run with your confirmed mappings to get the corrected figures.

## 6. Your questions and how they are handled

**"Designation to Assignment Name was correct. How do I connect the mappings?"**
Your mapping is now confirmed in the dashboard and locked, and it is saved in a profile. The data alone does not settle this. Designation matches Job in 60% of rows and Assignment Name in 47%, so an automatic rule will favour Job. This is why the studio flags the pair as "Confirm" and asks you to decide.

**"Check the name first, then partial match, then values; check the type first, then first 10, last 10, and random 10."**
Implemented as stages 1 to 3 (see 4.2). The sampling is over matched records, and the type check compares the type of values, not the values.

**"Primary key matches two columns in the compare file."**
Partly handled. If the second column holds the same key values (98% or more identical), it becomes a key alias and is not used as a data column. If the two columns hold different values, the second is listed as an alternative key candidate, but the dashboard does not yet ask you to choose between them. This is item 1 in section 7.

**"Check the result and tell me the error percentage."**
See section 5: automatic mapping error 14.3% on the original database and 0% on the renamed database; data error 15.3% and 11.4%. The numbers are measured against your confirmed mappings.

## 7. What still needs doing

Priority order.

1. **Key conflict prompt.** When two compare columns match the source key but differ from each other, show both in the Key panel and let the user choose.
2. **Test on another pair of files.** Everything has been tested on two data sets from one project. Run a second, unrelated pair and tune thresholds (0.85, 0.5, 0.3, the 0.15 sample cut-off) if needed.
3. **One-to-many relationships.** A source record with several compare rows (for example transactions) is currently matched to one row. Add a mode that reports all rows.
4. **Persist profiles by column fingerprint, not just by label.** Labels change when files are renamed (as with the renamed database). Match stored pairs by name and type fingerprint.
5. **Bundle the libraries** (SheetJS, Chart.js, ExcelJS) inside the HTML, so the dashboard works offline and does not depend on cdnjs.
6. **Performance for large files.** Above roughly 50,000 rows, move analysis into a Web Worker so the page stays responsive.
7. **Automated tests in CI.** Move the test scripts into a proper test runner and add a fixed expected-results file.
8. **Clean up.** Remove the unused candidate fields in `engine.js` (`eqShare`, `sampleVs`) or document them, and split `app_template.html` into separate CSS and JS files.
9. **Report styling.** ExcelJS supports the colours used; check how the report looks in Excel and Google Sheets on a real machine. The sandbox cannot open Excel.
10. **Confirm the cdnjs URLs.** These were tested locally with the same library versions, not against the live CDN. Check that the three script tags load on your machine on first open.

## 8. Decisions made, and why

- **Confirmed mappings grade the automatic result, not the locked one.** Otherwise accuracy would always be 100% and tell you nothing.
- **Low-similarity guard (under 30%).** Stops the studio auto-mapping `OfficeName → Location Name`, which has no real equivalence in the data.
- **Most complete row for duplicate keys.** Rather than the first row, which was arbitrary.
- **Derived columns lose to real columns.** Avoids mapping `First + Last` when the file already has `FullName`.
- **Exact name match is never flagged as ambiguous.** It is the strongest evidence available.
- **Data error rate excludes blanks and formatting differences.** Blanks are a completeness issue, and formatting differences are not errors.

## 9. Continuing in a new chat

Paste the following into a new chat and attach `source/engine.js`, `source/app_template.html`, and `HANDOVER.md`:

> I am continuing a data reconciliation tool (single-file HTML dashboard, engine in engine.js). Read HANDOVER.md first. The current state is in the attached files. Next task: [pick one from section 7, e.g. item 1: the key-conflict prompt]. Keep the staged matching order (name, value type, sampled values, full values), keep confirmed mappings as the ground truth for error rates, and rebuild with build.py after changes.
