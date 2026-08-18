/* Inkgrid compositor — client-side only */

(function () {
  "use strict";

  var RAMPS = {
    press: "¶█▓※+=·.",
    sparse: "※+· ",
    block: "■▣▪· "
  };

  var GROUNDS = {
    paper: "#f4ead8",
    ink: "#1a1410",
    transparent: null
  };

  var MAX_EDGE = 880;

  var state = {
    source: null,
    cellSize: 10,
    brightness: 0,
    contrast: 0,
    invert: false,
    ramp: "press",
    mode: "characters",
    screen: "error",
    ground: "paper",
    label: "House mark"
  };

  var lastGrid = null;
  var copyResetTimer = null;

  var els = {
    file: document.getElementById("file"),
    loadBtn: document.getElementById("loadBtn"),
    exportBtn: document.getElementById("exportBtn"),
    copyBtn: document.getElementById("copyBtn"),
    cellSize: document.getElementById("cellSize"),
    cellOut: document.getElementById("cellOut"),
    brightness: document.getElementById("brightness"),
    brightOut: document.getElementById("brightOut"),
    contrast: document.getElementById("contrast"),
    contrastOut: document.getElementById("contrastOut"),
    invert: document.getElementById("invert"),
    preview: document.getElementById("preview"),
    stage: document.getElementById("stage"),
    status: document.getElementById("status"),
    hint: document.getElementById("hint")
  };

  function createHouseMark() {
    var w = 720;
    var h = 720;
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");

    var wash = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 460);
    wash.addColorStop(0, "#3d3428");
    wash.addColorStop(0.55, "#1c1612");
    wash.addColorStop(1, "#0b0907");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#ead9b8";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 292, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 248, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#d8c4a0";
    ctx.beginPath();
    ctx.moveTo(w / 2, 168);
    ctx.lineTo(w / 2 + 176, h / 2);
    ctx.lineTo(w / 2, h - 168);
    ctx.lineTo(w / 2 - 176, h / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#16110d";
    ctx.beginPath();
    ctx.moveTo(w / 2, 232);
    ctx.lineTo(w / 2 + 98, h / 2);
    ctx.lineTo(w / 2, h - 232);
    ctx.lineTo(w / 2 - 98, h / 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#f4ead8";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(88, h / 2);
    ctx.lineTo(w - 88, h / 2);
    ctx.moveTo(w / 2, 88);
    ctx.lineTo(w / 2, h - 88);
    ctx.stroke();

    ctx.fillStyle = "#b42318";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f4ead8";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ead9b8";
    ctx.font = '600 36px "Iowan Old Style", Palatino, Georgia, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("INKGRID", w / 2, h - 64);

    return c;
  }

  function isSupportedImage(file) {
    if (!file) return false;
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) return true;
    return /\.(jpe?g|png|webp|gif)$/i.test(file.name || "");
  }

  function canvasFromImage(img) {
    var c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return c;
  }

  function setSource(canvas, label) {
    state.source = canvas;
    state.label = label;
    els.status.textContent = label;
    render();
  }

  function loadFile(file) {
    if (!isSupportedImage(file)) {
      els.status.textContent = "Use jpg, png, webp, or gif.";
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      setSource(canvasFromImage(img), file.name);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      els.status.textContent = "Could not read that plate.";
    };
    img.src = url;
  }

  function adjust(lum) {
    var v = lum + state.brightness / 100;
    v = (v - 0.5) * (1 + state.contrast / 100) + 0.5;
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    if (state.invert) v = 1 - v;
    return v;
  }

  function sampleGrid() {
    var src = state.source;
    var cell = state.cellSize;
    var fit = Math.min(MAX_EDGE / src.width, MAX_EDGE / src.height, 1);
    var outW = Math.max(cell, Math.floor(src.width * fit));
    var outH = Math.max(cell, Math.floor(src.height * fit));
    var cols = Math.max(1, Math.floor(outW / cell));
    var rows = Math.max(1, Math.floor(outH / cell));

    var sample = document.createElement("canvas");
    sample.width = cols;
    sample.height = rows;
    var sctx = sample.getContext("2d", { willReadFrequently: true });
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(src, 0, 0, cols, rows);
    var data = sctx.getImageData(0, 0, cols, rows).data;
    var values = new Float32Array(cols * rows);
    var i;
    var o;
    var lum;

    for (i = 0; i < cols * rows; i++) {
      o = i * 4;
      lum = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
      values[i] = adjust(lum);
    }

    return {
      cols: cols,
      rows: rows,
      values: values,
      width: cols * cell,
      height: rows * cell,
      cell: cell
    };
  }

  var BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ];

  function ditherError(values, cols, rows) {
    var buf = new Float32Array(values);
    var bits = new Uint8Array(cols * rows);
    var x;
    var y;
    var i;
    var old;
    var ink;
    var neu;
    var err;

    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        i = y * cols + x;
        old = buf[i];
        if (old < 0) old = 0;
        if (old > 1) old = 1;
        ink = old < 0.5 ? 1 : 0;
        neu = ink ? 0 : 1;
        err = old - neu;
        bits[i] = ink;
        if (x + 1 < cols) {
          buf[i + 1] += err * (7 / 16);
        }
        if (y + 1 < rows) {
          if (x > 0) {
            buf[i + cols - 1] += err * (3 / 16);
          }
          buf[i + cols] += err * (5 / 16);
          if (x + 1 < cols) {
            buf[i + cols + 1] += err * (1 / 16);
          }
        }
      }
    }

    return bits;
  }

  function ditherOrdered(values, cols, rows) {
    var bits = new Uint8Array(cols * rows);
    var x;
    var y;
    var i;
    var t;

    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        i = y * cols + x;
        t = (BAYER8[(y % 8) * 8 + (x % 8)] + 0.5) / 64;
        bits[i] = values[i] < t ? 1 : 0;
      }
    }

    return bits;
  }

  function glyphAt(glyphs, brightness) {
    var idx = Math.floor((1 - brightness) * glyphs.length);
    if (idx < 0) idx = 0;
    if (idx >= glyphs.length) idx = glyphs.length - 1;
    return glyphs.charAt(idx);
  }

  function render() {
    if (!state.source) return;

    var grid = sampleGrid();
    var canvas = els.preview;
    canvas.width = grid.width;
    canvas.height = grid.height;
    var ctx = canvas.getContext("2d");
    var fill = GROUNDS[state.ground];
    var inkOnPaper = state.ground !== "ink";
    var fg = inkOnPaper ? "#1a1410" : "#f4ead8";
    var cell = grid.cell;
    var x;
    var y;
    var v;
    var ch;
    var r;
    var glyphs;
    var bits;
    var pad;
    var size;

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, grid.width, grid.height);
    } else {
      ctx.clearRect(0, 0, grid.width, grid.height);
    }

    ctx.fillStyle = fg;

    if (state.mode === "characters") {
      glyphs = RAMPS[state.ramp];
      ctx.font = "700 " + cell + "px " + 'ui-monospace, Menlo, "SF Mono", Consolas, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (y = 0; y < grid.rows; y++) {
        for (x = 0; x < grid.cols; x++) {
          v = grid.values[y * grid.cols + x];
          ch = glyphAt(glyphs, v);
          if (ch !== " ") {
            ctx.fillText(ch, x * cell + cell / 2, y * cell + cell / 2 + 0.5);
          }
        }
      }
    } else if (state.mode === "halftone") {
      for (y = 0; y < grid.rows; y++) {
        for (x = 0; x < grid.cols; x++) {
          v = grid.values[y * grid.cols + x];
          r = (inkOnPaper ? 1 - v : v) * cell * 0.48;
          if (r > 0.35) {
            ctx.beginPath();
            ctx.arc(x * cell + cell / 2, y * cell + cell / 2, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else {
      bits = state.screen === "ordered"
        ? ditherOrdered(grid.values, grid.cols, grid.rows)
        : ditherError(grid.values, grid.cols, grid.rows);
      pad = cell * 0.08;
      size = cell - pad * 2;
      for (y = 0; y < grid.rows; y++) {
        for (x = 0; x < grid.cols; x++) {
          if (bits[y * grid.cols + x]) {
            ctx.fillRect(x * cell + pad, y * cell + pad, size, size);
          }
        }
      }
    }

    lastGrid = grid;
    els.copyBtn.disabled = state.mode !== "characters";
    els.copyBtn.title = state.mode === "characters" ? "Copy the type as plain text" : "Available in Characters mode";
  }

  function exportPng() {
    els.preview.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement("a");
      var url = URL.createObjectURL(blob);
      a.href = url;
      a.download = "inkgrid.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function copyType() {
    if (state.mode !== "characters" || !lastGrid) return;
    var glyphs = RAMPS[state.ramp];
    var lines = [];
    var y;
    var x;
    var line;
    var v;
    for (y = 0; y < lastGrid.rows; y++) {
      line = "";
      for (x = 0; x < lastGrid.cols; x++) {
        v = lastGrid.values[y * lastGrid.cols + x];
        line += glyphAt(glyphs, v);
      }
      lines.push(line);
    }
    var text = lines.join("\n");
    var done = function () {
      els.copyBtn.textContent = "Pulled";
      if (copyResetTimer) window.clearTimeout(copyResetTimer);
      copyResetTimer = window.setTimeout(function () {
        els.copyBtn.textContent = "Copy type";
      }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text, done);
      });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (err) {
      els.status.textContent = "Copy failed.";
    }
    ta.remove();
  }

  function bind() {
    els.loadBtn.addEventListener("click", function () {
      els.file.click();
    });

    els.file.addEventListener("change", function () {
      if (els.file.files && els.file.files[0]) {
        loadFile(els.file.files[0]);
        els.file.value = "";
      }
    });

    els.exportBtn.addEventListener("click", exportPng);
    els.copyBtn.addEventListener("click", copyType);

    els.cellSize.addEventListener("input", function () {
      state.cellSize = parseInt(els.cellSize.value, 10);
      els.cellOut.value = String(state.cellSize);
      render();
    });

    els.brightness.addEventListener("input", function () {
      state.brightness = parseInt(els.brightness.value, 10);
      els.brightOut.value = String(state.brightness);
      render();
    });

    els.contrast.addEventListener("input", function () {
      state.contrast = parseInt(els.contrast.value, 10);
      els.contrastOut.value = String(state.contrast);
      render();
    });

    els.invert.addEventListener("change", function () {
      state.invert = els.invert.checked;
      render();
    });

    document.querySelectorAll('input[name="ramp"]').forEach(function (el) {
      el.addEventListener("change", function () {
        if (el.checked) {
          state.ramp = el.value;
          render();
        }
      });
    });

    document.querySelectorAll('input[name="mode"]').forEach(function (el) {
      el.addEventListener("change", function () {
        if (el.checked) {
          state.mode = el.value;
          render();
        }
      });
    });

    document.querySelectorAll('input[name="screen"]').forEach(function (el) {
      el.addEventListener("change", function () {
        if (el.checked) {
          state.screen = el.value;
          render();
        }
      });
    });

    document.querySelectorAll('input[name="ground"]').forEach(function (el) {
      el.addEventListener("change", function () {
        if (el.checked) {
          state.ground = el.value;
          render();
        }
      });
    });

    els.stage.addEventListener("dragover", function (e) {
      e.preventDefault();
      els.stage.classList.add("is-drop");
    });

    els.stage.addEventListener("dragleave", function () {
      els.stage.classList.remove("is-drop");
    });

    els.stage.addEventListener("drop", function (e) {
      e.preventDefault();
      els.stage.classList.remove("is-drop");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadFile(e.dataTransfer.files[0]);
      }
    });

    els.stage.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      els.file.click();
    });

    els.stage.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        els.file.click();
      }
    });
  }

  bind();
  setSource(createHouseMark(), "House mark");
})();
