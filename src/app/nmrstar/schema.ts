export class Schema {
  version: string;
  headers: string[];
  schema: {};
  tag_order: string[];
  category_order: string[];

  data_types = {};

  constructor (version: string, headers: string[], tags: string[][], data_types: {}) {
    this.version = version;
    this.headers = headers;
    this.data_types = data_types;
    this.category_order = [];
    this.tag_order = [];
    this.schema = {};

    const tag_col = this.headers.indexOf('Tag');
    const cat_col = this.headers.indexOf('SFCategory');

    for (const schem_tag of tags) {
      // Set the category order and tag order
      this.tag_order.push(schem_tag[tag_col]);
      if (this.category_order.indexOf(schem_tag[cat_col]) < 0) {
        this.category_order.push(schem_tag[cat_col]);
      }

      const tt = {};
      for (let i = 0; i <= this.headers.length; i++) {
        tt[schem_tag[tag_col]][this.headers[i]] = schem_tag[i];
      }
    }
  }
}
