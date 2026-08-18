# Inkgrid

Inkgrid is a small compositor for the browser. Load a photograph and press it into a grid of type, or a field of ink dots. Two proofs only: **Characters** and **Halftone**.

It is a static site — four files of HTML, CSS, and JavaScript. No build step, no packages.

## Run locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server
```

Then visit `http://localhost:8000`.

The compositor is `editor.html`.

## Privacy

All processing happens in the browser. Images never leave the machine. There is no upload, no account, and no remote render.

## Note

Inkgrid is an original tool and is not affiliated with any other ASCII or image-to-type product.
