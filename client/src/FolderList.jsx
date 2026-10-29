import React, { useState } from 'react';

// ელემენტების დაჯგუფება საქაღალდეებად (item.folder). საქაღალდის გარეშე ელემენტები ზემოთაა.
// არასავალდებულო: extraFolders - ცარიელი საქაღალდეები, folderAction(f) - ღილაკები საქაღალდის მარჯვნივ,
// onMove(itemId, folder) - ჩართავს გადათრევას (ელემენტი draggable უნდა იყოს და dataTransfer-ში id ჩაწეროს).
export default function FolderList({ items, renderItem, empty, extraFolders = [], folderAction, onMove }) {
  const [closed, setClosed] = useState({});
  const [over, setOver] = useState(null); // '' = საქაღალდის გარეშე, სხვა შემთხვევაში საქაღალდის სახელი
  const loose = items.filter((i) => !i.folder);
  const folders = [...new Set([...items.filter((i) => i.folder).map((i) => i.folder), ...extraFolders])]
    .sort((a, b) => a.localeCompare(b, 'ka'));

  const drop = (folder) => ({
    onDragOver: onMove ? (e) => { e.preventDefault(); e.stopPropagation(); setOver(folder); } : undefined,
    onDragLeave: onMove ? () => setOver((o) => (o === folder ? null : o)) : undefined,
    onDrop: onMove ? (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOver(null);
      const id = e.dataTransfer.getData('text/plain');
      if (id) onMove(id, folder);
    } : undefined,
  });

  if (!items.length && !folders.length) return <p className="muted" style={{ padding: 8 }}>{empty}</p>;
  return (
    <div className={`folder-root ${over === '' ? 'drop-over' : ''}`} {...drop('')}>
      {loose.map(renderItem)}
      {folders.map((f) => {
        const list = items.filter((i) => i.folder === f);
        const open = !closed[f];
        return (
          <div className={`folder ${over === f ? 'drop-over' : ''}`} key={f} {...drop(f)}>
            <div className="folder-row">
              <button className="folder-head" aria-expanded={open} onClick={() => setClosed({ ...closed, [f]: open })}>
                <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                <span className="folder-name">{f}</span>
                <span className="lbl">{list.length}</span>
              </button>
              {folderAction && <span className="folder-actions">{folderAction(f)}</span>}
            </div>
            {open && (
              <div className="folder-body">
                {list.map(renderItem)}
                {!list.length && <p className="muted folder-empty">ცარიელია{onMove ? ': გადმოათრიე შაბლონი' : ''}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const folderNames = (items) => [...new Set(items.map((i) => i.folder).filter(Boolean))];
