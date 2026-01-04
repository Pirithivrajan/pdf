pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const viewer = document.getElementById("viewer");
const uploadPdf = document.getElementById("uploadPdf");
const addText = document.getElementById("addText");
const imageUpload = document.getElementById("imageUpload");
const generate = document.getElementById("generate");
const download = document.getElementById("download");
const saveLayout = document.getElementById("saveLayout");
const loadLayout = document.getElementById("loadLayout");
const signBtn = document.getElementById("signBtn");

const textInput = document.getElementById("textInput");
const fontSize = document.getElementById("fontSize");
const rotation = document.getElementById("rotation");
const fontFamily = document.getElementById("fontFamily");

const signCanvas = document.getElementById("signCanvas");
const sctx = signCanvas.getContext("2d");

let pdfBuffer;
let pages = [];
let items = [];

uploadPdf.onchange = async e => {
  viewer.innerHTML = "";
  pages = [];
  items = [];

  pdfBuffer = await e.target.files[0].arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;

    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;

    const div = document.createElement("div");
    div.className = "page";
    div.dataset.page = i;
    div.appendChild(canvas);
    viewer.appendChild(div);
    pages.push(div);
  }
};

addText.onclick = () => {
  const el = document.createElement("div");
  el.className = "item";
  el.textContent = textInput.value;
  el.style.fontSize = fontSize.value + "px";
  el.style.transform = `rotate(${rotation.value}deg)`;
  el.dataset.font = fontFamily.value;
  el.style.left = "50px";
  el.style.top = "50px";
  pages[0].appendChild(el);
  drag(el);
  items.push(el);
};

imageUpload.onchange = e => {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(e.target.files[0]);
  img.className = "item";
  img.style.width = "120px";
  img.style.left = "50px";
  img.style.top = "50px";
  pages[0].appendChild(img);
  drag(img);
  items.push(img);
};

signBtn.onclick = () => {
  signCanvas.style.display = "block";
  let drawing = false;

  signCanvas.onmousedown = () => drawing = true;
  signCanvas.onmouseup = () => drawing = false;
  signCanvas.onmousemove = e => {
    if (!drawing) return;
    sctx.lineTo(e.offsetX, e.offsetY);
    sctx.stroke();
  };

  signCanvas.ondblclick = () => {
    const img = document.createElement("img");
    img.src = signCanvas.toDataURL();
    img.className = "item";
    img.style.width = "150px";
    pages[0].appendChild(img);
    drag(img);
    items.push(img);
    signCanvas.style.display = "none";
    sctx.clearRect(0, 0, signCanvas.width, signCanvas.height);
  };
};

function drag(el) {
  let dx = 0, dy = 0, drag = false;
  el.onmousedown = e => { drag = true; dx = e.offsetX; dy = e.offsetY; };
  document.onmousemove = e => {
    if (!drag) return;
    el.style.left = e.pageX - dx + "px";
    el.style.top = e.pageY - dy + "px";
  };
  document.onmouseup = () => drag = false;
}

saveLayout.onclick = () => {
  const data = items.map(el => ({
    html: el.outerHTML,
    page: el.closest(".page").dataset.page
  }));
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "layout.json";
  a.click();
};

loadLayout.onchange = async e => {
  const data = JSON.parse(await e.target.files[0].text());
  items = [];
  data.forEach(d => {
    const page = pages[d.page - 1];
    const el = document.createElement("div");
    el.innerHTML = d.html;
    const real = el.firstChild;
    page.appendChild(real);
    drag(real);
    items.push(real);
  });
};

generate.onclick = async () => {
  const pdfDoc = await PDFLib.PDFDocument.load(pdfBuffer);

  for (const el of items) {
    const pageDiv = el.closest(".page");
    const page = pdfDoc.getPages()[pageDiv.dataset.page - 1];
    const canvas = pageDiv.querySelector("canvas");
    const cr = canvas.getBoundingClientRect();
    const er = el.getBoundingClientRect();

    const x = er.left - cr.left;
    const y = canvas.height - (er.top - cr.top);

    if (el.tagName === "IMG") {
      const imgBytes = await fetch(el.src).then(r => r.arrayBuffer());
      const img = await pdfDoc.embedPng(imgBytes);
      page.drawImage(img, { x, y, width: el.width, height: el.height });
    } else {
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts[el.dataset.font]);
      page.drawText(el.textContent, {
        x, y,
        size: parseInt(el.style.fontSize),
        rotate: PDFLib.degrees(parseInt(rotation.value)),
        font
      });
    }
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  download.href = URL.createObjectURL(blob);
  download.download = "final.pdf";
  download.style.display = "inline";
};
