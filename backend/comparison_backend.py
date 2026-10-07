"""
comparison_backend.py
---------------------
Separate Backend for Pre/Post Check Comparison ONLY
- Does NOT go into app.py
- Keeps 100% exact characters (alpha, numeric, special like [root@NAMELG03 ~]#)
- Input: pre.txt, post.txt (txt format)
- Output: HTML exact comparison like Notepad++ Compare
- No JSON conversion, No Excel (fixes PK... is not valid JSON error)
- Runs on port 8001 so your main app.py can still run on 8000

Run: uvicorn comparison_backend:app --reload --port 8001
Test: http://127.0.0.1:8001
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import difflib
import html
import io
from pathlib import Path

app = FastAPI(
    title="TASS - Pre/Post Comparison Backend (Separate)",
    description="Exact txt comparison - Keeps special chars, returns HTML",
    version="1.0"
)

# Allow frontend to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def compare_files_exact(pre_lines, post_lines):
    """
    Core logic: Compares two list of lines exactly
    Returns: html_rows, counts
    """
    matcher = difflib.SequenceMatcher(None, pre_lines, post_lines)
    html_rows = ""
    added = removed = changed = unchanged = 0
    line_no = 1

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for k in range(i1, i2):
                unchanged += 1
                safe = html.escape(pre_lines[k])
                # Preserve empty lines visually
                display_safe = safe if safe else "&nbsp;"
                html_rows += f'<tr style="background:#ffffff"><td class="ln">{line_no}</td><td class="st" style="background:#f1f5f9">UNCHANGED</td><td><pre>{display_safe}</pre></td><td><pre>{display_safe}</pre></td></tr>'
                line_no += 1
        elif tag == 'delete':
            for k in range(i1, i2):
                removed += 1
                safe = html.escape(pre_lines[k])
                display_safe = safe if safe else "&nbsp;"
                html_rows += f'<tr style="background:#ffebe9"><td class="ln">{line_no}</td><td class="st" style="background:#ffebe9;color:#991b1b">REMOVED</td><td><pre>{display_safe}</pre></td><td><pre></pre></td></tr>'
                line_no += 1
        elif tag == 'insert':
            for k in range(j1, j2):
                added += 1
                safe = html.escape(post_lines[k])
                display_safe = safe if safe else "&nbsp;"
                html_rows += f'<tr style="background:#e6ffec"><td class="ln">{line_no}</td><td class="st" style="background:#e6ffec;color:#166534">ADDED</td><td><pre></pre></td><td><pre>{display_safe}</pre></td></tr>'
                line_no += 1
        elif tag == 'replace':
            max_len = max(i2 - i1, j2 - j1)
            for k in range(max_len):
                changed += 1
                pre_line = pre_lines[i1 + k] if i1 + k < i2 else ""
                post_line = post_lines[j1 + k] if j1 + k < j2 else ""
                safe_pre = html.escape(pre_line)
                safe_post = html.escape(post_line)
                safe_pre = safe_pre if safe_pre else "&nbsp;"
                safe_post = safe_post if safe_post else "&nbsp;"
                html_rows += f'<tr style="background:#fff8c5"><td class="ln">{line_no}</td><td class="st" style="background:#fff8c5;color:#854d0e">CHANGED</td><td><pre>{safe_pre}</pre></td><td><pre>{safe_post}</pre></td></tr>'
                line_no += 1

    return html_rows, added, removed, changed, unchanged

@app.get("/")
def root():
    return {
        "message": "TASS Pre/Post Comparison Backend Running",
        "port": "8001",
        "endpoints": {
            "/compare": "POST - Upload pre.txt and post.txt, returns HTML exact comparison",
            "/compare-inline": "POST - Returns HTML to display directly in frontend (not download)",
            "/docs": "API documentation"
        },
        "usage": "uvicorn comparison_backend:app --reload --port 8001"
    }

@app.post("/compare")
async def compare_and_download(
    pre_file: UploadFile = File(..., description="Pre-check .txt file with alpha, numeric, special chars"),
    post_file: UploadFile = File(..., description="Post-check .txt file")
):
    """
    Main endpoint: Upload two txt files, get exact HTML comparison file download
    - Keeps [root@NAMELG03 ~]#, $ % ^ etc exact
    - No JSON, returns HTML file
    """
    # Read exact bytes - preserve everything
    pre_bytes = await pre_file.read()
    post_bytes = await post_file.read()

    # Decode - try utf-8 first, then latin-1 (latin-1 keeps 0-255 exact, never fails)
    try:
        pre_text = pre_bytes.decode('utf-8')
    except UnicodeDecodeError:
        pre_text = pre_bytes.decode('latin-1')

    try:
        post_text = post_bytes.decode('utf-8')
    except UnicodeDecodeError:
        post_text = post_bytes.decode('latin-1')

    pre_lines = pre_text.splitlines()
    post_lines = post_text.splitlines()

    html_rows, added, removed, changed, unchanged = compare_files_exact(pre_lines, post_lines)
    total_diff = added + removed + changed

    full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pre/Post Exact Comparison - TASS</title>
<style>
    * {{ box-sizing: border-box; }}
    body {{ font-family: 'Consolas', 'Courier New', monospace; margin: 0; padding: 20px; background: #f8fafc; color: #1e293b; }}
    .header {{ background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px; border: 1px solid #e2e8f0; }}
    .header h1 {{ margin: 0 0 8px 0; font-size: 18px; color: #0f172a; }}
    .header p {{ margin: 0; color: #64748b; font-size: 13px; }}
    .stats {{ display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }}
    .badge {{ padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; border: 1px solid; }}
    .b-added {{ background: #dcfce7; color: #166534; border-color: #86efac; }}
    .b-removed {{ background: #fee2e2; color: #991b1b; border-color: #fca5a5; }}
    .b-changed {{ background: #fef9c3; color: #854d0e; border-color: #fde047; }}
    .b-unchanged {{ background: #f1f5f9; color: #475569; border-color: #cbd5e1; }}
    table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
    th {{ background: #0f172a; color: white; padding: 12px 10px; text-align: left; font-size: 12px; position: sticky; top: 0; z-index: 10; }}
    td {{ border-bottom: 1px solid #f1f5f9; padding: 0; vertical-align: top; }}
    td.ln {{ width: 70px; text-align: center; background: #f8fafc; color: #94a3b8; font-size: 11px; padding: 8px; }}
    td.st {{ width: 110px; text-align: center; font-weight: bold; font-size: 11px; padding: 8px; }}
    td pre {{ margin: 0; padding: 8px 10px; white-space: pre-wrap; word-break: break-all; font-size: 12px; line-height: 1.6; font-family: 'Consolas', monospace; }}
    .legend {{ margin-top: 20px; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; line-height: 1.6; }}
</style>
</head>
<body>
<div class="header">
    <h1>🔍 TASS - PRE/POST-CHECK EXACT COMPARISON</h1>
    <p>Files: <b>{html.escape(pre_file.filename)}</b> vs <b>{html.escape(post_file.filename)}</b> | Keeps alpha, numeric, special chars exact including [root@NAMELG03 ~]#</p>
    <div class="stats">
        <span class="badge b-added">ADDED: {added}</span>
        <span class="badge b-removed">REMOVED: {removed}</span>
        <span class="badge b-changed">CHANGED: {changed}</span>
        <span class="badge b-unchanged">UNCHANGED: {unchanged}</span>
        <span class="badge b-unchanged">TOTAL DIFF: {total_diff}</span>
    </div>
</div>
<table>
<thead><tr><th>Line</th><th>Status</th><th>Pre-Check File (Exact from {html.escape(pre_file.filename)})</th><th>Post-Check File (Exact from {html.escape(post_file.filename)})</th></tr></thead>
<tbody>{html_rows}</tbody>
</table>
<div class="legend">
<b>Legend:</b><br>
🟩 <span style="background:#e6ffec;padding:2px 8px;border-radius:4px">ADDED</span> = Line exists only in Post file (green)<br>
🟥 <span style="background:#ffebe9;padding:2px 8px;border-radius:4px">REMOVED</span> = Line exists only in Pre file (red)<br>
🟨 <span style="background:#fff8c5;padding:2px 8px;border-radius:4px">CHANGED</span> = Line modified between files (yellow)<br>
⬜ UNCHANGED = Same in both files (white)<br>
<b>Note:</b> All alpha, numeric, special characters like $ % ^ & * ( ) [ ] {{ }} @ # are preserved 100% exact as in your txt files. No JSON conversion.
</div>
</body>
</html>
"""

    buffer = io.BytesIO(full_html.encode('utf-8'))
    return StreamingResponse(
        buffer,
        media_type="text/html",
        headers={
            "Content-Disposition": f"attachment; filename=Comparison_{Path(pre_file.filename).stem}_vs_{Path(post_file.filename).stem}.html"
        }
    )

@app.post("/compare-inline")
async def compare_inline(
    pre_file: UploadFile = File(...),
    post_file: UploadFile = File(...)
):
    """
    Same as /compare but returns HTML to display directly in frontend div
    (not as download file). Frontend can do innerHTML = response
    """
    pre_bytes = await pre_file.read()
    post_bytes = await post_file.read()

    try:
        pre_text = pre_bytes.decode('utf-8')
    except:
        pre_text = pre_bytes.decode('latin-1')
    try:
        post_text = post_bytes.decode('utf-8')
    except:
        post_text = post_bytes.decode('latin-1')

    pre_lines = pre_text.splitlines()
    post_lines = post_text.splitlines()

    html_rows, added, removed, changed, unchanged = compare_files_exact(pre_lines, post_lines)

    full_html = f"""
    <div style="font-family:Consolas,monospace">
    <div style="padding:10px;background:#f8fafc;border-radius:6px;margin-bottom:10px">
    <b>Result:</b> Added:{added} | Removed:{removed} | Changed:{changed} | Unchanged:{unchanged}
    </div>
    <table style="width:100%;border-collapse:collapse;background:white;font-size:12px">
    <tr style="background:#0f172a;color:white"><th style="padding:8px">Line</th><th style="padding:8px">Status</th><th style="padding:8px">Pre-Check Exact</th><th style="padding:8px">Post-Check Exact</th></tr>
    {html_rows}
    </table>
    </div>
    """

    return StreamingResponse(
        io.BytesIO(full_html.encode('utf-8')),
        media_type="text/html"
    )

if __name__ == "__main__":
    import uvicorn
    # Runs on 8001 so your main app.py can run on 8000 at same time
    uvicorn.run("comparison_backend:app", host="0.0.0.0", port=8001, reload=True)
