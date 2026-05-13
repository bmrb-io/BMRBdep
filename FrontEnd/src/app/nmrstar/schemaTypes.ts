/* Type definitions for the NMR-STAR schema and entry JSON consumed from the backend.
   The server sends "table-shaped" data (parallel headers/values arrays) which Schema then
   pivots into dictionaries keyed by header name. */

// Anything with a .test(string) => boolean predicate; covers RegExp and the NotNullChecker class.
export interface Tester {
  test(value: string): boolean;
}

/* ===== Raw JSON shapes (server -> Schema constructor) ===== */

export interface RawTagTable {
  headers: string[];
  /* Tag rows keyed by tag name; each row is a value-per-header array. Enumerations
     have a nested shape — see TagSchemaEntry['enumerations']. */
  values: { [tagName: string]: unknown[] };
}

export interface RawSaveframeTable {
  headers: string[];
  values: { [category: string]: unknown[] };
}

export interface RawValueRows {
  headers: string[];
  values: unknown[][];
}

export interface FileUploadType {
  /* [description, exts, category, ...] — see DataFile.dropDownList consumers */
  [index: number]: unknown;
}

export interface SchemaJSON {
  version: string;
  tags: RawTagTable;
  data_types: { [dataType: string]: string };
  overrides: RawValueRows;
  category_supergroups: RawValueRows;
  supergroup_descriptions: RawValueRows;
  saveframes: RawSaveframeTable;
  file_upload_types: FileUploadType[];
}

/* ===== Parsed schema dictionaries ===== */

export interface TagSchemaEntry {
  'BMRB data type'?: string;
  Regex: Tester;
  enumerations?: [string, string][];
  'User full view'?: string;
  'Item enumerated'?: string;
  'Item enumeration closed'?: string;
  'Enumeration ties'?: string;
  'Sf pointer'?: string;
  'Foreign Table'?: string | null;
  'default value'?: string;
  Example?: string;
  Prompt?: string;
  Interface?: string;
  Nullable?: boolean;
  Tag?: string;
  SFCategory?: string;
  'ADIT category view name'?: string;
  /* Any other dictionary-derived field we haven't called out yet. */
  [key: string]: unknown;
}

export interface SaveframeSchemaEntry {
  'ADIT replicable'?: boolean;
  category_group_view_name?: string;
  group_view_help?: string;
  mandatory_number?: number;
  [key: string]: unknown;
}

export interface OverrideRule {
  'Conditional tag': string;
  'Conditional tag prefix': string;
  'Tag category': string;
  Tag: string;
  'Sf category'?: string;
  'Override view value': string;
  'Override value': string;
  Regex: Tester;
  [key: string]: unknown;
}

export interface SuperGroupRecord {
  category_super_group: string;
  category_super_group_ID: string;
  saveframe_category: string;
  [key: string]: unknown;
}

export interface SuperGroupDescription {
  super_group_name: string;
  Description: string;
  [key: string]: unknown;
}

/* ===== Entry / saveframe / loop JSON shapes ===== */

export interface LoopJSON {
  category: string;
  tags: string[];
  data: string[][];
}

/* The server sends tag pairs as positional [name, value] arrays, but some code paths
   produce { name, value } objects (see Saveframe.addTags). Accept both. */
export type TagPair = [string, string] | { name: string; value: string };

export interface SaveframeJSON {
  name: string;
  category: string;
  tag_prefix: string;
  tags: TagPair[];
  loops: LoopJSON[];
}

export interface EntryJSON {
  entry_id: string;
  schema: SchemaJSON;
  email_validated: boolean;
  entry_deposited: boolean;
  deposition_nickname: string;
  bmrbnum: number;
  /* Older cached entries stored a single string; current backend sends an array. */
  commit: string | string[];
  unsaved?: boolean;
  saveframes: SaveframeJSON[];
  data_files?: string[];
}
