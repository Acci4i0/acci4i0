# Acci4i0

A personal portfolio built as a series of rebuild studies. The home page is modeled on [rauno.me](https://rauno.me); each project linked from the Projects section is a separate rebuild of a site I wanted to study. All code is written from scratch (copied source if you can).

## Stack

* Vanilla HTML, CSS, JavaScript — no framework, no build step
* GitHub Pages for hosting

## Structure

```
/
├── index.html          Home page (rauno.me study)
├── style.css
├── script.js
├── /studies            Individual rebuild studies
│   ├── /"\*/Andrelndo"        kimdot.de study
│   ├── /"cruci.v£rba"         sa-m.fr study
│   └── /"cavallooo…"  endless.horse study
├── /\_tools             Playwright extraction scripts (not deployed)
├── README.md
```

## Local development

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Pushed to `main` and served via GitHub Pages at `https://acci4i0.github.io/Acci4i0/`.

```bash
git add .
git commit -m "update: <what changed>"
git push
```

First-time Pages setup:

```bash
gh repo edit --enable-pages --pages-branch main
```

## Author

Andrea Lando — [LinkedIn](https://www.linkedin.com/in/andrea-lando-2a51833b3) · [Email](mailto:lando.andrea04@gmail.com)

