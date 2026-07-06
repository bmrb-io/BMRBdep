// lint-staged config: run `ng lint` against only the staged files.
//
// `ng lint` (the @angular-eslint builder) doesn't accept a plain list of files
// the way lint-staged appends them, but it does accept repeated
// `--lint-file-patterns=<file>` flags. We build that command here so the
// pre-commit hook keeps using ng lint / eslint.config.js, just scoped to the
// files being committed instead of the whole project.
module.exports = {
  '*.{ts,html}': (files) => {
    const patterns = files.map((file) => `--lint-file-patterns="${file}"`).join(' ')
    return `ng lint ${patterns}`
  },
}
