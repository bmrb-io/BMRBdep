# TODO — verified code issues

Findings from a code review, each re-checked in full context. Grouped by
confidence/severity. File:line references are from the state of the tree at
review time (branch `development`).

---

## Confirmed bugs (fix these)

### 1. `tag.ts:180` — unary-plus typo renders `"NaN"`
`FrontEnd/src/app/nmrstar/tag.ts:180`

```ts
sampleName = sampleFrame.getTag('Sf_framecode')!.value + +' (Unnamed)';
```

The `+ +' (Unnamed)'` applies a **unary** `+` to the string literal, which
evaluates to `NaN`. So an unnamed sample's experiment-pointer label renders as
`"<framecode>NaN"` instead of `"<framecode> (Unnamed)"`.

- **Fix:** delete the stray `+` → `... .value + ' (Unnamed)'`.
- **Reference:** the two sibling branches in the same method already do it
  correctly: `tag.ts:195` (sample conditions) and `tag.ts:206` (spectrometer).
- **Severity:** low (cosmetic, but user-visible in the experiment dropdown).

### 2. `depositions.py:274` — First_initial is never formatted (wrong column)
`BackEnd/bmrbdep/depositions.py:265-275`

```python
middle_initial_index = loop.tag_index('Middle_initials')
first_initial_index = loop.tag_index('First_initial')
for row in loop.data:
    if middle_initial_index and row[middle_initial_index]:
        row[middle_initial_index] = ".".join(row[middle_initial_index].replace(".", "")) + '.'
    if first_initial_index and row[middle_initial_index]:          # <-- reads middle, not first
        row[middle_initial_index] = ".".join(row[middle_initial_index].replace(".", "")) + '.'
```

The second block guards on `first_initial_index` but both reads and writes
`row[middle_initial_index]`. Net effect: `First_initial` is never reformatted
into dotted form (e.g. `"JR"` → `"J.R."`), and `Middle_initials` is processed
twice. Runs on `_Contact_person`, `_Entry_author`, `_Citation_author` at deposit
time, so it ships malformed author initials into the final NMR-STAR.

- **Fix:** the second block should operate on `first_initial_index`:
  ```python
  if first_initial_index is not None and row[first_initial_index]:
      row[first_initial_index] = ".".join(row[first_initial_index].replace(".", "")) + '.'
  ```
- **Severity:** medium (incorrect deposited data, runs on every deposit).
- See also issue #4 — apply the `is not None` fix here at the same time.

### 3. `__init__.py:666` — annotator email send is mis-indented
`BackEnd/bmrbdep/__init__.py:650-666` (inside `deposit_entry`)

```python
# Send a message to the annotators
if not configuration['debug']:
    if isinstance(configuration['smtp']['annotator_address'], list):
        send_to = configuration['smtp']['annotator_address']
    else:
        send_to = [configuration['smtp']['annotator_address']]
    message = Message("BMRBdep: BMRB entry %s has been deposited." % bmrb_num, recipients=send_to)
    message.body = '''...''' % (uuid, bmrb_num, ...)
mail.send(message)          # <-- dedented: outside the `if`
```

`mail.send(message)` sits at the same indentation as the `if`, so it always
runs. In production (`debug=False`) it correctly sends the annotator message.
But when `debug=True` **and** a real SMTP server is configured (i.e. `mail` is
not the `MockMail` fallback), the `message` built in this block is skipped and
`mail.send(message)` re-sends the *previous* object — the
"Your entry has been deposited!" confirmation built at `__init__.py:637-648` —
giving the depositor a duplicate email. The intent is clearly "only email
annotators when not in debug."

- **Fix:** indent `mail.send(message)` to be inside the `if not configuration['debug']:` block.
- **Severity:** low (debug-only duplicate email), but it's a clear logic slip.

---

## Verify-intent items (off-by-one / latent)

### 4. `depositions.py:272,274` — `if <index>:` treats column 0 as missing
`BackEnd/bmrbdep/depositions.py:272,274` (same block as #2)

`loop.tag_index(...)` returns `Optional[int]` — `None` when the tag is absent,
otherwise the integer index, **which can be 0** (confirmed in
`pynmrstar/loop.py: tag_index`). The truthiness guards `if middle_initial_index`
/ `if first_initial_index` therefore silently skip a tag that legitimately sits
in the first column.

- Currently latent: in `_Contact_person` / `_Entry_author` / `_Citation_author`
  the first column is an ordinal/ID, not an initials tag, so index 0 doesn't
  occur today. Still fragile against schema reordering.
- **Fix:** use `is not None` instead of truthiness (fold into the #2 fix).
- **Severity:** low (latent).

### 5. `depositions.py:415` — BMRB ID range excludes its upper bound
`BackEnd/bmrbdep/depositions.py:415`

```python
ids_in_range: set = set(range(id_range[0], id_range[1]))
```

`range(lo, hi)` is half-open, so the highest ID in each configured range is
never assignable. With the shipped config `ets.deposition_ranges = [[40000, 50000]]`
(`BackEnd/bmrbdep/configuration.json:6`), accession number 50000 can never be
issued.

- **Decision needed:** are the configured ranges meant to be inclusive of the
  upper bound? If yes → `range(id_range[0], id_range[1] + 1)`. If the ranges are
  deliberately defined as exclusive-upper, this is fine and should just get a
  clarifying comment.
- **Severity:** low (loses exactly one ID per range).

---

## Deprecations / cleanup

### 6. `datetime.utcnow()` is deprecated (project requires Python 3.13)
`BackEnd/bmrbdep/__init__.py:322` and `:573`

```python
'creation_date': datetime.datetime.utcnow().strftime("%I:%M %p on %B %d, %Y"),
```

`datetime.utcnow()` is deprecated as of Python 3.12; `pyproject.toml` pins
`requires-python = ">=3.13"`. The codebase already uses the correct form
elsewhere — `depositions.py:458`:
`datetime.now(timezone.utc).strftime(...)`.

- **Fix:** `datetime.datetime.now(datetime.timezone.utc).strftime(...)` at both
  sites. Output format is unchanged.
- **Severity:** low (DeprecationWarning; still functions).

### 7. Divergent email filtering between the two DB-metadata writers
`BackEnd/bmrbdep/depositions.py:148-149` vs `BackEnd/bmrbdep/database.py:111`

Both write the `depositions.author_emails` column, but inconsistently:

- `_update_database_metadata` filters placeholders:
  ```python
  author_emails = [_ for _ in contact_loop.get_tag('Email_address')
                   if _ != "." and _ != "?" and _ is not None]
  ```
- `rescan` stores them raw:
  ```python
  author_emails = contact_loop.get_tag('Email_address')
  ```

So whether the column contains `"."`/`"?"` placeholders depends on which path
last wrote the row. ORCIDs are filtered consistently in both; emails are not.

- **Fix:** apply the same filter in `database.py:111` (extract a shared helper).
- **Severity:** low (data-quality inconsistency in the metadata DB).

### 8. `logging.exception(...)` called with no active exception
`BackEnd/bmrbdep/__init__.py:744` and `BackEnd/bmrbdep/depositions.py:427`

Both call `logging.exception(...)` on a normal (non-`except`) code path:

- `__init__.py:744` — stale-commit branch in `fetch_or_store_deposition` PUT,
  right before returning `{'error': 'reload'}`.
- `depositions.py:427` — "no valid IDs remaining in any range" branch.

`logging.exception` appends the current exception traceback, which here is
`NoneType: None`, producing misleading logs.

- **Fix:** use `logging.warning` / `logging.error`.
- **Severity:** low (log noise / misleading tracebacks).

### 9. Broad `except Exception` swallows DB-metadata failures
`BackEnd/bmrbdep/depositions.py:192-193`

`_update_database_metadata` wraps its entire body in `except Exception:` →
`logging.warning(...)`. A deposit/commit can succeed while its metadata-DB
update silently fails. Acceptable as a non-fatal best-effort sync, but the
swallow is wide and only logs at WARNING.

- **Suggestion:** narrow the catch or at least log at ERROR with the deposition
  id so these are noticeable.
- **Severity:** low.

### 10. Unclosed file handles in `common.py`
`BackEnd/bmrbdep/common.py:14`, `:59`, and `get_schema` XML branch (`:47`)

```python
configuration: dict = json.loads(open(os.path.join(root_dir, 'configuration.json'), "r").read())  # :14
return open(os.path.join(root_dir, 'version.txt'), 'r').read().strip()                              # :59 (get_release)
return open(os.path.join(schema_dir, version + '.xml'), 'r')                                        # :47 (handed to caller)
```

`:14` and `:59` leak a handle until GC; `get_release` is called per deposit.
The XML branch deliberately returns an open handle for `pynmrstar.Schema(...)`
to consume — confirm the consumer closes it.

- **Fix:** use `with open(...) as f:` for `:14`/`:59`.
- **Severity:** very low.

### 11. Explicit `self._repo.__del__()` call
`BackEnd/bmrbdep/depositions.py:109`

```python
self._repo.close()
self._repo.__del__()
```

Calling the dunder directly (immediately after `close()`) is redundant and
non-idiomatic — `close()` already releases GitPython resources.

- **Fix:** drop the `__del__()` line.
- **Severity:** very low.

### 12. Dead `CLEANUP_TODO.md` reference in CLAUDE.md
`CLAUDE.md` (Code conventions section) points to `FrontEnd/CLEANUP_TODO.md`,
which does not exist in the tree.

- **Fix:** remove the reference, or recreate the file.
- **Severity:** trivial (doc drift).

---

## Informational (reviewed, low risk — decide whether to act)

- **Local-IP detection uses string prefix matching.**
  `BackEnd/bmrbdep/__init__.py:144` — `request.remote_addr.startswith(local_address)`
  decides whether to reveal full tracebacks to "local" clients. Prefix matching
  is imprecise (e.g. `"10.0.0."` vs CIDR semantics). Low risk since it only
  gates traceback disclosure and `remote_addr` isn't trivially spoofable behind
  the proxy, but `ipaddress`-based matching would be more correct.

- **`CORS(application)` opens all origins when `debug` is true.**
  `BackEnd/bmrbdep/__init__.py:33-37`. Intended for local dev. Ensure production
  never runs with `configuration['debug'] = true`.

---

## Checked and NOT an issue (no action)

- **RxJS positional `subscribe(fn, fn)`** — CLAUDE.md warns about it, but the
  codebase already uses object-form `subscribe({next, error})` everywhere.
  Remaining single-argument `subscribe(fn)` calls are **not** deprecated. No
  change needed.
