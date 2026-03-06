import React, { useEffect, useMemo, useState } from "react";

const LAYOUTS = {
  FULL: "full",
  CARD: "card",
};

const COLLECTIONS = {
  REGULAR: "regular",
  CURATED: "curated",
};

const defaultRange = { begin: "", end: "" };
const STORAGE_KEY = "library-signage-tool-state-v1";
const DEFAULT_QR_1_TITLE = "Library search";
const DEFAULT_QR_1_PATH = "library-search";
const DEFAULT_QR_2_TITLE = "Call number guide";
const DEFAULT_QR_2_PATH = "call-number-guide";

function normalizeQrPath(path) {
  const raw = (path || "").trim();
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\/lib\.arizona\.edu\/s\//i, "")
    .replace(/^lib\.arizona\.edu\/s\//i, "")
    .replace(/^\/+/, "");
}

function extractPathFromLegacyUrl(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = normalizeQrPath(value);
  return normalized || fallback;
}

function buildLibraryUrl(path) {
  const normalized = normalizeQrPath(path);
  return `https://lib.arizona.edu/s/${normalized || "collection-link"}`;
}

function buildQrImageSrc(url) {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encoded}`;
}

function splitCallNumber(value) {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) {
    return { first: tokens.join(" ") || "PN 1995.9", second: "H5 B553" };
  }
  return {
    first: tokens.slice(0, 2).join(" "),
    second: tokens.slice(2).join(" "),
  };
}

function App() {
  const [layout, setLayout] = useState(LAYOUTS.FULL);
  const [collectionType, setCollectionType] = useState(COLLECTIONS.REGULAR);
  const [collectionText, setCollectionText] = useState("Children's Literature");
  const [regularSubjects, setRegularSubjects] = useState(["Language & literature", "", ""]);
  const [regularSubjectCount, setRegularSubjectCount] = useState(1);
  const [ranges, setRanges] = useState([{ begin: "PN 1995.9 H5 B553", end: "PN 1998 A2 J28 1980" }, { ...defaultRange }, { ...defaultRange }]);
  const [qrTitle1, setQrTitle1] = useState(DEFAULT_QR_1_TITLE);
  const [qrTitle2, setQrTitle2] = useState(DEFAULT_QR_2_TITLE);
  const [qrPath1, setQrPath1] = useState(DEFAULT_QR_1_PATH);
  const [qrPath2, setQrPath2] = useState(DEFAULT_QR_2_PATH);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (parsed.layout === LAYOUTS.FULL || parsed.layout === LAYOUTS.CARD) {
        setLayout(parsed.layout);
      }
      if (parsed.collectionType === COLLECTIONS.REGULAR || parsed.collectionType === COLLECTIONS.CURATED) {
        setCollectionType(parsed.collectionType);
      }
      if (typeof parsed.collectionText === "string") {
        setCollectionText(parsed.collectionText);
      }
      if (Array.isArray(parsed.regularSubjects)) {
        const nextSubjects = [0, 1, 2].map((index) => (typeof parsed.regularSubjects[index] === "string" ? parsed.regularSubjects[index] : ""));
        setRegularSubjects(nextSubjects);
      }
      if (Number.isInteger(parsed.regularSubjectCount) && parsed.regularSubjectCount >= 1 && parsed.regularSubjectCount <= 3) {
        setRegularSubjectCount(parsed.regularSubjectCount);
      }
      if (Array.isArray(parsed.ranges)) {
        const nextRanges = [0, 1, 2].map((index) => {
          const candidate = parsed.ranges[index] || {};
          return {
            begin: typeof candidate.begin === "string" ? candidate.begin : "",
            end: typeof candidate.end === "string" ? candidate.end : "",
          };
        });
        setRanges(nextRanges);
      }
      if (typeof parsed.qrTitle1 === "string") {
        setQrTitle1(parsed.qrTitle1);
      }
      if (typeof parsed.qrTitle2 === "string") {
        setQrTitle2(parsed.qrTitle2);
      }
      if (typeof parsed.qrPath1 === "string") {
        setQrPath1(normalizeQrPath(parsed.qrPath1));
      } else if (typeof parsed.qr1 === "string") {
        setQrPath1(extractPathFromLegacyUrl(parsed.qr1, DEFAULT_QR_1_PATH));
      }
      if (typeof parsed.qrPath2 === "string") {
        setQrPath2(normalizeQrPath(parsed.qrPath2));
      } else if (typeof parsed.qr2 === "string") {
        setQrPath2(extractPathFromLegacyUrl(parsed.qr2, DEFAULT_QR_2_PATH));
      }
    } catch {
      // Ignore malformed persisted state and continue with defaults.
    }
  }, []);

  useEffect(() => {
    const payload = {
      layout,
      collectionType,
      collectionText,
      regularSubjects,
      regularSubjectCount,
      ranges,
      qrTitle1,
      qrTitle2,
      qrPath1,
      qrPath2,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [layout, collectionType, collectionText, regularSubjects, regularSubjectCount, ranges, qrTitle1, qrTitle2, qrPath1, qrPath2]);

  const isFull = layout === LAYOUTS.FULL;
  const isCurated = collectionType === COLLECTIONS.CURATED;

  const labelForCollectionText = isCurated ? "Collection Name" : "Subject";

  const visibleRanges = useMemo(() => {
    if (isFull) return [ranges[0]];
    return ranges;
  }, [isFull, ranges]);

  function handleRangeChange(index, key, value) {
    setRanges((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function handlePrint() {
    window.print();
  }

  function handleRegularSubjectChange(index, value) {
    setRegularSubjects((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleAddRegularSubjectField() {
    setRegularSubjectCount((prev) => Math.min(3, prev + 1));
  }

  const regularSubjectsForInput = regularSubjects.slice(0, regularSubjectCount);
  const regularSubjectsForPreview = regularSubjectsForInput.map((subject) => subject.trim()).filter(Boolean);

  return (
    <main className="container py-4 signage-root">
      <div className="row g-4 no-print">
        <section className="col-12 col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h1 className="mt-0">Collection sign maker</h1>
              <p>
                This tool is compatible with <b>Google Chrome.</b>
              </p>
              <h2 className="">Layout</h2>

              <div className="mb-3">
                <label className="form-label" htmlFor="sign-size">
                  Sign size
                </label>
                <select id="sign-size" className="form-select" value={layout} onChange={(event) => setLayout(event.target.value)}>
                  <option value={LAYOUTS.FULL}>Full</option>
                  <option value={LAYOUTS.CARD}>Card</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="form-label" htmlFor="collection-type">
                  Collection
                </label>
                <select id="collection-type" className="form-select" value={collectionType} onChange={(event) => setCollectionType(event.target.value)}>
                  <option value={COLLECTIONS.REGULAR}>Regular stack</option>
                  <option value={COLLECTIONS.CURATED}>Curated collection</option>
                </select>
              </div>

              <h2 className="">Collection Information</h2>

              <div className="mb-3">
                <label className="form-label" htmlFor="collection-text">
                  {labelForCollectionText}
                </label>
                {isFull && !isCurated ? (
                  <>
                    {regularSubjectsForInput.map((subject, index) => (
                      <input key={`subject-field-${index}`} id={index === 0 ? "collection-text" : `collection-text-${index + 1}`} type="text" className="form-control mb-2" value={subject} onChange={(event) => handleRegularSubjectChange(index, event.target.value)} placeholder={index === 0 ? "e.g., Language & literature" : `Subject ${index + 1}`} />
                    ))}
                    {regularSubjectCount < 3 && (
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleAddRegularSubjectField}>
                        Add subject
                      </button>
                    )}
                  </>
                ) : (
                  <input id="collection-text" type="text" className="form-control" value={collectionText} onChange={(event) => setCollectionText(event.target.value)} placeholder={isCurated ? "e.g., Books That Matter" : "e.g., Science"} />
                )}
              </div>

              {visibleRanges.map((range, index) => (
                <div className="row g-2 mb-3" key={`range-${index}`}>
                  <div className="col-12">
                    <h3 className="h4">{isFull ? "Call Number Range" : `Range ${index + 1}`}</h3>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor={`begin-${index}`}>
                      Call number begin
                    </label>
                    <input id={`begin-${index}`} type="text" className="form-control" value={range.begin} onChange={(event) => handleRangeChange(index, "begin", event.target.value)} placeholder="Begin" />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor={`end-${index}`}>
                      Call number end
                    </label>
                    <input id={`end-${index}`} type="text" className="form-control" value={range.end} onChange={(event) => handleRangeChange(index, "end", event.target.value)} placeholder="End" />
                  </div>
                </div>
              ))}

              {isFull && (
                <>
                  <h2 className="">QR Codes</h2>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="qr-1-title">
                      QR code 1 link title
                    </label>
                    <input id="qr-1-title" type="text" className="form-control" value={qrTitle1} onChange={(event) => setQrTitle1(event.target.value)} placeholder="Library search" />
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="qr-1-path">
                      QR code 1 URL (second line)
                    </label>
                    <input id="qr-1-path" type="text" className="form-control" value={qrPath1} onChange={(event) => setQrPath1(normalizeQrPath(event.target.value))} placeholder="call-number-guide" />
                  </div>

                  <div className="mb-4">
                    <label className="form-label" htmlFor="qr-2-title">
                      QR code 2 link title
                    </label>
                    <input id="qr-2-title" type="text" className="form-control" value={qrTitle2} onChange={(event) => setQrTitle2(event.target.value)} placeholder="Call number guide" />
                  </div>

                  <div className="mb-4">
                    <label className="form-label" htmlFor="qr-2-path">
                      QR code 2 URL (second line)
                    </label>
                    <input id="qr-2-path" type="text" className="form-control" value={qrPath2} onChange={(event) => setQrPath2(normalizeQrPath(event.target.value))} placeholder="childrens-literature" />
                  </div>
                </>
              )}
              <h2 className="">Ready to print?</h2>
              <p>
                In the print window, make sure the <b>Background graphics</b> option is checked.
              </p>
              <button type="button" className="btn btn-red w-100" onClick={handlePrint}>
                Print sign
              </button>
            </div>
          </div>
        </section>

        <section className="col-12 col-lg-7">
          <PrintPreview isFull={isFull} isCurated={isCurated} collectionText={collectionText} regularSubjectsForPreview={regularSubjectsForPreview} ranges={visibleRanges} qr1Url={buildLibraryUrl(qrPath1)} qr2Url={buildLibraryUrl(qrPath2)} qr1Path={normalizeQrPath(qrPath1)} qr2Path={normalizeQrPath(qrPath2)} qr1Label={qrTitle1 || DEFAULT_QR_1_TITLE} qr2Label={qrTitle2 || DEFAULT_QR_2_TITLE} />
        </section>
      </div>

      <div className="print-only">
        <PrintPreview isFull={isFull} isCurated={isCurated} collectionText={collectionText} regularSubjectsForPreview={regularSubjectsForPreview} ranges={visibleRanges} qr1Url={buildLibraryUrl(qrPath1)} qr2Url={buildLibraryUrl(qrPath2)} qr1Path={normalizeQrPath(qrPath1)} qr2Path={normalizeQrPath(qrPath2)} qr1Label={qrTitle1 || DEFAULT_QR_1_TITLE} qr2Label={qrTitle2 || DEFAULT_QR_2_TITLE} />
      </div>
    </main>
  );
}

function PrintPreview({ isFull, isCurated, collectionText, regularSubjectsForPreview, ranges, qr1Url, qr2Url, qr1Path, qr2Path, qr1Label, qr2Label }) {
  if (isFull) {
    const fullClass = isCurated ? "full-curated" : "full-regular";
    const beginCall = splitCallNumber(ranges[0].begin || "");
    const endCall = splitCallNumber(ranges[0].end || "");

    return (
      <article className={`sign sign-full ${fullClass}`}>
        <section className={`full-layout ${isCurated ? "full-layout-curated" : "full-layout-regular"}`}>
          {isCurated && (
            <div className="full-box full-box-collection">
              <p className="full-collection-title">{collectionText || "Collection Name"}</p>
              <p className="full-collection-note">Collection</p>
            </div>
          )}

          <div className="full-call-wrap">
            <div className="full-call-block">
              <p className="full-call-strong">{beginCall.first}</p>
              <p className="full-call-normal">{beginCall.second}</p>
            </div>
            <p className="full-call-to">to</p>
            <div className="full-call-block">
              <p className="full-call-strong">{endCall.first}</p>
              <p className="full-call-normal">{endCall.second}</p>
            </div>
          </div>

          {!isCurated && (
            <div className="full-regular-bottom">
              <div className="full-box full-box-subject">
                <div className="full-subject-list">
                  {(regularSubjectsForPreview.length > 0 ? regularSubjectsForPreview : ["Subject"]).map((subject, index) => (
                    <p className="full-subject" key={`subject-preview-${index}`}>
                      {subject}
                    </p>
                  ))}
                </div>
              </div>
              <div className="full-link-row">
                <QrBlock url={qr1Url} label={qr1Label} pathLine={qr1Path} />
                <QrBlock url={qr2Url} label={qr2Label} pathLine={qr2Path} />
              </div>
            </div>
          )}

          {isCurated && (
            <div className="full-link-row">
              <QrBlock url={qr1Url} label={qr1Label} pathLine={qr1Path} />
              <QrBlock url={qr2Url} label={qr2Label} pathLine={qr2Path} />
            </div>
          )}
        </section>
      </article>
    );
  }

  return (
    <article className="sign sign-card">
      <header className="sign-header">University Libraries</header>
      <section className="card-grid">
        {ranges.map((range, index) => (
          <div className="card-row" key={`card-row-${index}`}>
            {isCurated && <p className="card-collection">{collectionText || "Collection Name"}</p>}
            <p className="card-range">
              {range.begin || "BEGIN"} - {range.end || "END"}
            </p>
          </div>
        ))}
      </section>
    </article>
  );
}

function QrBlock({ url, label, pathLine }) {
  return (
    <div className="qr-block full-link-box">
      <img src={buildQrImageSrc(url)} alt="QR code" />
      <div className="full-link-text">
        <p className="full-link-title">{label}</p>
        <div className="full-link-url-block">
          <p className="full-link-url">lib.arizona.edu/s/</p>
          <p className="full-link-url">{pathLine || "collection-link"}</p>
        </div>
      </div>
    </div>
  );
}

export default App;
