import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";

const LAYOUTS = {
  FULL: "full",
  CARD: "card",
  HALF: "half",
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

// Library of Congress Classification mapping
const LOC_CLASSIFICATIONS = {
  A: "General Works",
  B: "Philosophy, Psychology, Religion",
  C: "Auxiliary Sciences of History",
  D: "World History",
  E: "History of America",
  F: "History of the Americas",
  G: "Geography, Anthropology, and Recreation",
  H: "Social Sciences",
  J: "Political Science",
  K: "Law",
  L: "Education",
  M: "Music",
  N: "Fine Arts",
  P: "Language and Literature",
  Q: "Science",
  R: "Medicine",
  S: "Agriculture",
  T: "Technology",
  U: "Military Science",
  V: "Naval Science",
  Z: "Bibliography, Library Science, and General Information",
};

// Extract first letter from call number
function getCallNumberLetter(callNumber) {
  if (!callNumber || typeof callNumber !== "string") return null;
  const trimmed = callNumber.trim();
  if (!trimmed) return null;
  const firstLetter = trimmed.charAt(0).toUpperCase();
  return LOC_CLASSIFICATIONS[firstLetter] ? firstLetter : null;
}

// Get all subjects between two letters (inclusive)
function getSubjectsBetweenLetters(beginLetter, endLetter) {
  if (!beginLetter || !endLetter) return [];
  
  const letters = Object.keys(LOC_CLASSIFICATIONS).sort();
  const beginIndex = letters.indexOf(beginLetter);
  const endIndex = letters.indexOf(endLetter);
  
  if (beginIndex === -1 || endIndex === -1) return [];
  
  const start = Math.min(beginIndex, endIndex);
  const end = Math.max(beginIndex, endIndex);
  
  return letters.slice(start, end + 1).map(letter => LOC_CLASSIFICATIONS[letter]);
}

function defaultHalfSign() {
  return {
    layout: "collection", collection: "", subjects: "",
    links: [
      { enabled: true, title: DEFAULT_QR_1_TITLE, path: DEFAULT_QR_1_PATH },
      { enabled: true, title: DEFAULT_QR_2_TITLE, path: DEFAULT_QR_2_PATH },
    ],
  };
}

function HalfEditor({ sign, index, isCurated, onChange, range, onRangeChange }) {
  const prefix = `half-${index}`;
  const includeLinks = sign.links.some(link => link.enabled);
  return <fieldset className="mb-4">
    <legend className="h4">{index === 0 ? "Top sign" : "Bottom sign"}</legend>
    {isCurated && <>
      <label className="form-label" htmlFor={`${prefix}-layout`}>Display</label>
      <select id={`${prefix}-layout`} className="form-select mb-3" value={sign.layout} onChange={e => onChange({ ...sign, layout: e.target.value })}>
        <option value="collection">Collection name</option><option value="subjects">Subjects</option>
      </select>
      <label className="form-label" htmlFor={`${prefix}-content`}>{sign.layout === "collection" ? "Collection name" : "Subjects (one per line)"}</label>
      {sign.layout === "collection"
        ? <input id={`${prefix}-content`} className="form-control mb-3" value={sign.collection} onChange={e => onChange({ ...sign, collection: e.target.value })} />
        : <textarea id={`${prefix}-content`} className="form-control mb-3" rows={3} value={sign.subjects} onChange={e => onChange({ ...sign, subjects: e.target.value })} />}
    </>}
    {!isCurated && <div className="mb-3">
      <p>Call number range {index + 1}</p>
      {["begin", "end"].map(key => <div className="mb-2" key={key}>
        <label className="form-label" htmlFor={`${prefix}-${key}`}>Call number {key}</label>
        <input id={`${prefix}-${key}`} className="form-control" value={range[key]} onChange={e => onRangeChange(index, key, e.target.value)} />
      </div>)}
    </div>}
    <div className="form-check mb-3">
      <input id={`${prefix}-links`} type="checkbox" className="form-check-input" checked={includeLinks} onChange={e => onChange({ ...sign, links: sign.links.map(link => ({ ...link, enabled: e.target.checked })) })} />
      <label htmlFor={`${prefix}-links`} className="form-check-label">Include links and QR codes</label>
    </div>
    {includeLinks && sign.links.map((link, linkIndex) => {
      const id = `${prefix}-link-${linkIndex}`;
      const update = patch => onChange({ ...sign, links: sign.links.map((item, i) => i === linkIndex ? { ...item, ...patch } : item) });
      return <div className="mb-3" key={id}>
          <label htmlFor={`${id}-title`} className="form-label">Link {linkIndex + 1} title</label>
          <input id={`${id}-title`} className="form-control mb-2" value={link.title} onChange={e => update({ title: e.target.value })} />
          <label htmlFor={`${id}-path`} className="form-label">Link {linkIndex + 1} URL</label>
          <div className="input-group"><span className="input-group-text">lib.arizona.edu/s/</span><input id={`${id}-path`} className="form-control" value={link.path} onChange={e => update({ path: normalizeQrPath(e.target.value) })} /></div>
      </div>;
    })}
  </fieldset>;
}

// Fit all content, including broad classification ranges, without clipping at print size.
function HalfContent({ className, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const fit = () => {
      if (!element.clientHeight) return;
      element.style.setProperty("--fit", "1");
      let scale = 1;
      while (element.scrollHeight > element.clientHeight + 1 && scale > 0.1) {
        scale -= 0.025;
        element.style.setProperty("--fit", String(scale));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    let active = true;
    document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [children]);
  return <div ref={ref} className={className}>{children}</div>;
}

function HalfPreview({ signs, ranges, isCurated }) {
  return <article className={`sign sign-half ${isCurated ? "half-curated" : "half-regular"}`}>
    {signs.map((sign, index) => {
      const subjects = isCurated ? sign.subjects.split("\n").map(s => s.trim()).filter(Boolean)
        : getSubjectsBetweenLetters(getCallNumberLetter(ranges[index].begin), getCallNumberLetter(ranges[index].end));
      const collection = isCurated && sign.layout === "collection";
      const links = sign.links.some(link => link.enabled) ? sign.links : [];
      return <section className="half-panel" key={index} aria-label={index === 0 ? "Top sign" : "Bottom sign"}>
        <div className="half-frame">
          <HalfContent className={`half-content ${collection ? "half-collection" : "half-subjects"}`}>
            {collection ? <><p className="full-collection-title">{sign.collection || "Collection Name"}</p><p className="full-collection-note">Collection</p></>
              : <div className="half-subject-list" style={{ '--subject-size': `${subjects.length > 6 ? 10 : subjects.length > 3 ? 16 : 28}`, '--subject-gap': subjects.length > 3 ? '4' : '24' }}>
                {(subjects.length ? subjects : [isCurated ? "Subjects" : "Enter a valid call number range"]).map((subject, i) => <p key={i}>{subject}</p>)}
              </div>}
          </HalfContent>
          {links.length > 0 && <div className="full-link-row">{links.map((link, i) => <QrBlock key={i} url={buildLibraryUrl(link.path)} label={link.title} pathLine={normalizeQrPath(link.path)} />)}</div>}
        </div>
      </section>;
    })}
  </article>;
}

function App() {
  const [halfSigns, setHalfSigns] = useState(() => [defaultHalfSign(), defaultHalfSign()]);
  const [layout, setLayout] = useState(LAYOUTS.FULL);
  const [collectionType, setCollectionType] = useState(COLLECTIONS.REGULAR);
  const [collectionText, setCollectionText] = useState("Children's Literature");
  const [regularSubjects, setRegularSubjects] = useState(["Language & literature", "", ""]);
  const [regularSubjectCount, setRegularSubjectCount] = useState(1);
  const [subjectSizeClass, setSubjectSizeClass] = useState("");
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

      if (parsed.layout === LAYOUTS.FULL || parsed.layout === LAYOUTS.CARD || parsed.layout === LAYOUTS.HALF) {
        setLayout(parsed.layout);
      }
      if (parsed.collectionType === COLLECTIONS.REGULAR || parsed.collectionType === COLLECTIONS.CURATED) {
        setCollectionType(parsed.collectionType);
      }
      if (Array.isArray(parsed.halfSigns)) {
        setHalfSigns([0, 1].map(index => {
          const saved = parsed.halfSigns[index] || {};
          const defaults = defaultHalfSign();
          return {
            layout: saved.layout === "subjects" ? "subjects" : "collection",
            collection: typeof saved.collection === "string" ? saved.collection : "",
            subjects: typeof saved.subjects === "string" ? saved.subjects : "",
            links: defaults.links.map((link, i) => {
              const value = saved.links?.[i] || {};
              return { enabled: typeof value.enabled === "boolean" ? value.enabled : true,
                title: typeof value.title === "string" ? value.title : link.title,
                path: typeof value.path === "string" ? normalizeQrPath(value.path) : link.path };
            }),
          };
        }));
      }
      if (typeof parsed.collectionText === "string") {
        setCollectionText(parsed.collectionText);
      }
      if (Array.isArray(parsed.regularSubjects)) {
        const nextSubjects = parsed.regularSubjects.map((subject) => (typeof subject === "string" ? subject : ""));
        setRegularSubjects(nextSubjects);
      }
      if (Number.isInteger(parsed.regularSubjectCount) && parsed.regularSubjectCount >= 1) {
        setRegularSubjectCount(parsed.regularSubjectCount);
      }
      if (typeof parsed.subjectSizeClass === "string") {
        setSubjectSizeClass(parsed.subjectSizeClass);
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
      halfSigns,
      layout,
      collectionType,
      collectionText,
      regularSubjects,
      regularSubjectCount,
      subjectSizeClass,
      ranges,
      qrTitle1,
      qrTitle2,
      qrPath1,
      qrPath2,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [halfSigns, layout, collectionType, collectionText, regularSubjects, regularSubjectCount, subjectSizeClass, ranges, qrTitle1, qrTitle2, qrPath1, qrPath2]);

  // Auto-populate subjects based on call number range (only for Full layout + Regular stack)
  useEffect(() => {
    if (layout !== LAYOUTS.FULL || collectionType !== COLLECTIONS.REGULAR) {
      return;
    }

    const firstRange = ranges[0];
    if (!firstRange.begin || !firstRange.end) {
      return;
    }

    const beginLetter = getCallNumberLetter(firstRange.begin);
    const endLetter = getCallNumberLetter(firstRange.end);

    if (!beginLetter || !endLetter) {
      return;
    }

    const subjects = getSubjectsBetweenLetters(beginLetter, endLetter);
    
    if (subjects.length === 0) {
      return;
    }

    // Show all subjects in the range
    const newSubjects = [...subjects, "", "", ""];
    const newCount = subjects.length;

    setRegularSubjects(newSubjects);
    setRegularSubjectCount(newCount);
  }, [layout, collectionType, ranges]);

  const isHalf = layout === LAYOUTS.HALF;
  const isFull = layout === LAYOUTS.FULL;
  const isCurated = collectionType === COLLECTIONS.CURATED;
  const showCollectionField = !isHalf && (isFull || isCurated);

  const labelForCollectionText = isCurated ? "Collection name" : "Subject";

  const visibleRanges = useMemo(() => {
    if (isHalf) return [];
    if (isFull) return [ranges[0]];
    return ranges;
  }, [isFull, isHalf, isCurated, ranges]);

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
    setRegularSubjects((prevSubjects) => {
      const nextCount = regularSubjectCount + 1;
      if (prevSubjects.length >= nextCount) {
        return prevSubjects;
      }
      return [...prevSubjects, ""];
    });
    setRegularSubjectCount((prev) => prev + 1);
  }

  const regularSubjectsForInput = regularSubjects.slice(0, regularSubjectCount).map((subject) => subject || "");
  const regularSubjectsForPreview = regularSubjectsForInput.map((subject) => subject.trim()).filter(Boolean);

  useEffect(() => {
    const subjectCount = regularSubjectsForPreview.length;
    let sizeClass = "";
    if (subjectCount >= 6) {
      sizeClass = "subjects-small";
    } else if (subjectCount >= 4) {
      sizeClass = "subjects-medium";
    }
    // 3 or less uses default (normal) size
    setSubjectSizeClass(sizeClass);
  }, [regularSubjectsForPreview]);

  return (
    <main className={`container py-4 signage-root${isHalf ? " signage-half" : ""}`}>
      <div className="row g-4 no-print">
        <section className="col-12 col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h1 className="mt-0 mb-2">Collection sign maker</h1>
              <p>
                This tool is compatible with <b>Google Chrome</b> on a desktop.
              </p>
              <h2 className="">Layout</h2>

              <div className="mb-3">
                <label className="form-label" htmlFor="sign-size">
                  Sign size
                </label>
                <select id="sign-size" className="form-select" value={layout} onChange={(event) => setLayout(event.target.value)}>
                  <option value={LAYOUTS.FULL}>Full</option>
                  <option value={LAYOUTS.HALF}>Half</option>
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

              <h2 className="">Collection information</h2>

              {isHalf && <p>Two half-size signs on one letter-size sheet. {isCurated ? "Choose the display and content for each sign independently." : "Enter one call number range per sign to look up its subjects."}</p>}
              {isHalf && halfSigns.map((sign, index) => <HalfEditor key={index} sign={sign} index={index} isCurated={isCurated} range={ranges[index]} onRangeChange={handleRangeChange} onChange={next => setHalfSigns(previous => previous.map((item, i) => i === index ? next : item))} />)}
              {showCollectionField && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="collection-text">
                    {labelForCollectionText}
                  </label>
                  {isFull && !isCurated ? (
                    <>
                      {regularSubjectsForInput.map((subject, index) => (
                        <input key={`subject-field-${index}`} id={index === 0 ? "collection-text" : `collection-text-${index + 1}`} type="text" className="form-control mb-2" value={subject} onChange={(event) => handleRegularSubjectChange(index, event.target.value)} placeholder={index === 0 ? "e.g., Language & literature" : `Subject ${index + 1}`} />
                      ))}
                      <button type="button" className="btn btn-add-subject btn-outline-secondary mt-1" onClick={handleAddRegularSubjectField}>
                        Add subject
                      </button>
                    </>
                  ) : (
                    <input id="collection-text" type="text" className="form-control" value={collectionText} onChange={(event) => setCollectionText(event.target.value)} placeholder={isCurated ? "e.g., Books That Matter" : "e.g., Science"} />
                  )}
                </div>
              )}

              {visibleRanges.map((range, index) => (
                <div className="row g-2 mb-3" key={`range-${index}`}>
                  <div className="col-12">
                    <h3 className="h4">{isFull ? "Call number range" : `Call number range ${index + 1}`}</h3>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor={`begin-${index}`}>
                      Call number begin
                    </label>
                    <input id={`begin-${index}`} type="text" className="form-control mb-2" value={range.begin} onChange={(event) => handleRangeChange(index, "begin", event.target.value)} placeholder="Begin" />
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
                  <h2 className="mb-2">Links</h2>
                  <p className="mb-4">
                    Contact <a href="web-support@lib.arizona.edu">Web Support</a> to request a short link that starts with <code>lib.arizona.edu/s/</code>.
                  </p>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="qr-1-title">
                      Link 1 title
                    </label>
                    <input id="qr-1-title" type="text" className="form-control" value={qrTitle1} onChange={(event) => setQrTitle1(event.target.value)} placeholder="Library search" />
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="qr-1-path">
                      Link 1 URL
                    </label>
                    <div class="input-group">
                      <span class="input-group-text" id="inputGroup-sizing-default">
                        lib.arizona.edu/s/
                      </span>
                      <input id="qr-1-path" type="text" className="form-control" value={qrPath1} onChange={(event) => setQrPath1(normalizeQrPath(event.target.value))} placeholder="call-number-guide" />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="qr-2-title">
                      Link 2 title
                    </label>
                    <input id="qr-2-title" type="text" className="form-control" value={qrTitle2} onChange={(event) => setQrTitle2(event.target.value)} placeholder="Call number guide" />
                  </div>

                  <div>
                    <label className="form-label" htmlFor="qr-2-path">
                      Link 2 URL
                    </label>
                    <div class="input-group">
                      <span class="input-group-text" id="inputGroup-sizing-default">
                        lib.arizona.edu/s/
                      </span>
                      <input id="qr-2-path" type="text" className="form-control" value={qrPath2} onChange={(event) => setQrPath2(normalizeQrPath(event.target.value))} placeholder="childrens-literature" />
                    </div>
                  </div>
                </>
              )}
              <h2 className="mb-2">Ready to print?</h2>
              <p className="mb-4">
                In the print window, make sure the <b>Background graphics</b> option is checked.
              </p>
              <button type="button" className="btn btn-red w-100" onClick={handlePrint}>
                Print sign
              </button>
            </div>
          </div>
        </section>

        <section className="col-12 col-lg-7">
          <h2 className="h4 mt-3 mb-4 text-center">Print preview</h2>
          <PrintPreview isHalf={isHalf} halfSigns={halfSigns} halfRanges={ranges} isFull={isFull} isCurated={isCurated} collectionText={collectionText} regularSubjectsForPreview={regularSubjectsForPreview} subjectSizeClass={subjectSizeClass} ranges={visibleRanges} qr1Url={buildLibraryUrl(qrPath1)} qr2Url={buildLibraryUrl(qrPath2)} qr1Path={normalizeQrPath(qrPath1)} qr2Path={normalizeQrPath(qrPath2)} qr1Label={qrTitle1 || DEFAULT_QR_1_TITLE} qr2Label={qrTitle2 || DEFAULT_QR_2_TITLE} />
        </section>
      </div>

      <div className="print-only">
        <PrintPreview isHalf={isHalf} halfSigns={halfSigns} halfRanges={ranges} isFull={isFull} isCurated={isCurated} collectionText={collectionText} regularSubjectsForPreview={regularSubjectsForPreview} subjectSizeClass={subjectSizeClass} ranges={visibleRanges} qr1Url={buildLibraryUrl(qrPath1)} qr2Url={buildLibraryUrl(qrPath2)} qr1Path={normalizeQrPath(qrPath1)} qr2Path={normalizeQrPath(qrPath2)} qr1Label={qrTitle1 || DEFAULT_QR_1_TITLE} qr2Label={qrTitle2 || DEFAULT_QR_2_TITLE} />
      </div>
    </main>
  );
}

function PrintPreview({ isHalf, halfSigns, halfRanges, isFull, isCurated, collectionText, regularSubjectsForPreview, subjectSizeClass, ranges, qr1Url, qr2Url, qr1Path, qr2Path, qr1Label, qr2Label }) {
  if (isHalf) return <HalfPreview signs={halfSigns} ranges={halfRanges} isCurated={isCurated} />;
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
              <div className={`full-box full-box-subject ${regularSubjectsForPreview.length > 4 ? "full-box-subject-tight" : ""}`}>
                <div className={`full-subject-list ${subjectSizeClass}`}>
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
    <article className={`sign sign-card ${isCurated ? "sign-card-curated" : "sign-card-regular"}`}>
      <section className="card-stack">
        <div className="card-grid">
          {ranges.map((range, index) => (
            <div className="card-row" key={`card-row-${index}`}>
              {isCurated && <p className="card-collection">{collectionText || "Collection Name"}</p>}
              <p className="card-range">{range.begin || "PL 216 S58 v.47 p.2"}</p>
              <p className="card-call-to">to</p>
              <p className="card-range">{range.end || "PL 2658 E3 S25"}</p>
            </div>
          ))}
        </div>
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
