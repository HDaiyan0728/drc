# Data Reconciliation Studio

A privacy-first, browser-based tool for validating and reconciling **any two Excel or CSV files**. It detects a likely matching key, suggests column mappings, compares matched records, highlights data-quality problems, and exports both **Excel** and **standalone HTML** reports.

## Why this project

Teams often need to compare an authoritative extract with a second system export, but column names, formatting, and data quality differ. Data Reconciliation Studio provides a repeatable review workflow without sending uploaded files to a server.

## Features

- Upload two `.xlsx`, `.xlsm`, `.xls`, or `.csv` files
- Select a worksheet when a workbook contains multiple sheets
- Automatically detect a near-unique shared key
- Manually override the key when automatic detection is unsuitable
- Suggest one-to-one column mappings using header names, synonyms, value types, sampled values, and full value similarity
- Save and load confirmed mapping profiles
- Identify matched, missing, extra, duplicate, and blank-key records
- Classify exact matches, formatting-only matches, conflicts, blank values, placeholders, and garbled text
- Show completeness and agreement metrics by column
- Filter and search mismatches and matched records
- Download a styled multi-sheet Excel report
- Download a portable, responsive HTML report
- Process files locally in the browser

## Privacy model

The application is static and performs parsing, comparison, and report generation in the browser. The selected spreadsheets are not intentionally uploaded to an application backend. The page loads SheetJS, Chart.js, and ExcelJS from cdnjs, so the browser still needs network access for those library files unless you bundle them locally.

## Project files

```text
.
├── index.html                    # Vercel entry point and complete application
├── Reconciliation_Studio.html    # Same standalone application with descriptive name
├── engine.js                     # Reconciliation logic without DOM dependencies
├── README.md                     # Project and deployment documentation
├── HANDOVER.md                   # Detailed implementation history and thresholds
├── package.json                  # Convenience scripts for Vercel CLI
└── vercel.json                   # Static deployment and security headers
```

## Run locally

### Fastest option

Open `index.html` in Chrome or Microsoft Edge. Internet access is required to download the three CDN libraries on first load.

### Local web server

A web server more closely matches Vercel behavior:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

### Vercel CLI

```bash
npm install -g vercel
vercel dev
```

## Deploy to Vercel

### Option 1: Git integration

1. Create a GitHub, GitLab, or Bitbucket repository.
2. Commit the files in this folder. Keep `index.html` at the repository root.
3. In Vercel, select **Add New → Project** and import the repository.
4. Use **Framework Preset: Other**.
5. Leave **Build Command** empty.
6. Leave **Output Directory** empty.
7. Select **Deploy**.

Every later push to the production branch will trigger another deployment.

### Option 2: Vercel CLI

From the project folder:

```bash
vercel
vercel --prod
```

No server, environment variable, database, or build step is required.

## Usage

1. Upload the authoritative file as **Source file**.
2. Upload the second export as **Compare file**.
3. If necessary, select the relevant worksheet for each file.
4. Select **Analyze & map columns**.
5. Review the detected key and column mappings.
6. Correct uncertain mappings or add confirmed mappings such as:

   ```text
   Assignment Name = Designation
   Office Name = (none)
   ```

   The left side is the compare-file column. The right side is the source-file column.
7. Select **Apply mapping & analyze**.
8. Review Overview, Missing & extra, Mismatches, Record comparison, and Data quality.
9. Open **Download report** and export either:
   - `.xlsx` for detailed analysis, filtering, handover, and follow-up work
   - `.html` for a portable summary that opens without Excel

## Matching pipeline

1. **Prepare files:** clean headers, identify value types, and create a derived full-name field when first and last names exist.
2. **Detect a key:** require approximately 95% uniqueness in each candidate column and at least 30% overlap between files.
3. **Join records:** normalize key values and select the most complete row when the compare file contains duplicate keys.
4. **Match columns:** evaluate exact names, synonym groups, shared words, spelling similarity, type compatibility, sampled values, and full-record value similarity.
5. **Analyze values:** classify exact, formatting-only, encoding, conflict, blank-source, blank-compare, and both-blank results.
6. **Report:** calculate coverage, agreement, error rates, completeness, duplicate groups, and actionable insights.

Thresholds are intentionally conservative. Review `HANDOVER.md` before changing them.

## Responsive design

The interface is optimized for desktop analysis while remaining usable on smaller screens:

- Long filenames, headers, keys, and cell values wrap safely
- Wide tables scroll inside their cards instead of expanding the page
- Tabs scroll horizontally on narrow screens
- KPI grids and two-column layouts collapse to one column
- Inputs and buttons become full-width on mobile
- Downloaded HTML reports use the same overflow protections

## Report contents

The Excel report may include:

- Summary
- Column Mapping
- Mapping Check, when confirmed mappings are supplied
- Mismatches
- Matched Records
- Missing in Database
- Extra in Database
- Duplicates
- Data Quality

The HTML report includes headline coverage, key insights, column mapping, mismatches, and record coverage. It is self-contained and can be emailed or archived as one file.

## Known limits

- Very large files can block the browser thread. For sustained workloads above roughly 50,000 rows, move analysis into a Web Worker and add progress reporting.
- The current join is designed for one primary record per key. One-to-many transaction comparisons need a separate matching mode.
- Automatic mapping is a suggestion, not business truth. Confirm mappings when similarly named fields have different meanings.
- CDN availability is required. For an offline deployment, download and serve pinned local copies of SheetJS, Chart.js, and ExcelJS.
- Spreadsheet formulas are read as exported cell values. The app does not recalculate workbook formulas.

## Browser support

Use a current version of Chrome or Microsoft Edge. Firefox and Safari should work for the main workflow, but report downloads and large-file memory behavior should be tested before organizational rollout.

## Security recommendations

- Keep the application static. Do not add spreadsheet uploads to a backend unless storage, retention, access control, encryption, and deletion requirements are defined.
- Pin external library versions and review them periodically.
- Avoid placing real personal data in public repositories or test fixtures.
- Use synthetic or anonymized files for demonstrations.
- For sensitive organizational use, bundle dependencies locally and apply an appropriate Content Security Policy after removing inline-script requirements.

## Troubleshooting

### The Analyze button remains disabled

Both file slots must contain a supported file. Replace a file if parsing failed.

### No key is detected

Open **Column mapping** and manually choose columns that identify the same record. A useful key should be populated, stable, and close to unique in both files.

### A column is mapped incorrectly

Choose the correct option in the mapping table or add an explicit confirmed mapping, then apply the mapping again.

### The page is blank after deployment

Confirm that `index.html` is in the repository root and that Vercel has no build command or output directory configured.

### Reports do not download

Allow downloads for the site, verify the browser console for CDN loading errors, and test in a current Chrome or Edge release.

### A table is wider than the screen

Scroll inside the table card. Long values are wrapped, while tables retain horizontal scrolling so headers and fields remain readable.

## Validation checklist before release

- Compare two unrelated file pairs, not only renamed copies of one data set
- Test XLSX and CSV inputs
- Test workbooks with multiple sheets
- Test long filenames, headers, URLs, and unbroken identifiers
- Test at 320 px, 768 px, 1366 px, and 1920 px viewport widths
- Verify manual key selection and confirmed mappings
- Open the Excel report in Microsoft Excel
- Open the HTML report in Chrome and Edge
- Confirm that no network request sends spreadsheet contents
- Test representative maximum file sizes on the target laptops

## License

Add the license your organization approves before publishing the repository publicly. Until then, treat the project as internal-use software.
