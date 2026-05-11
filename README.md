# NWCC Web Demo

Static rebuild of the NorthWest Collaborative Center website using the copied site materials.

## Local Preview

```sh
cd www.northwest-cc.org
python3 -m http.server 4173
```

Open `http://localhost:4173/`.

## Regenerate

The site is generated from `tools/nwcc-scrape.json`:

```sh
node tools/rebuild-static-site.mjs
```
