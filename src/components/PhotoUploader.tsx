import { useMemo, useRef, useState } from 'react';
import { renderCroppedDataUrl } from '../lib/photoCrop';
import type { PhotoData } from '../types/resume';

interface PhotoUploaderProps {
  photo?: PhotoData;
  onPhotoChange: (photo?: PhotoData) => void;
}

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const PhotoUploader = ({ photo, onPhotoChange }: PhotoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(-30);
  const [saving, setSaving] = useState(false);

  const isModalOpen = Boolean(source);

  const previewTransform = useMemo(
    () => ({ transform: `translate(${offsetX}%, ${offsetY}%) scale(${zoom})` }),
    [offsetX, offsetY, zoom],
  );

  const resetEditor = () => {
    setSource('');
    setZoom(1);
    setOffsetX(0);
    setOffsetY(-30);
    setSaving(false);
  };

  const openFilePicker = () => inputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ACCEPT_TYPES.includes(file.type)) {
      setError('仅支持 JPG / PNG / WEBP 图片。');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError('图片大小不能超过 5MB。');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
      });

      setError('');
      setSource(dataUrl);
      event.target.value = '';
    } catch {
      setError('读取图片失败，请重试。');
    }
  };

  const handleApply = async () => {
    try {
      setSaving(true);
      const cropped = await renderCroppedDataUrl(source, {
        zoom,
        offsetX,
        offsetY,
        outputSize: 360,
      });
      onPhotoChange({
        src: cropped,
        cropMeta: JSON.stringify({ zoom, offsetX, offsetY }),
      });
      resetEditor();
    } catch {
      setError('裁剪失败，请更换图片重试。');
      setSaving(false);
    }
  };

  return (
    <section className="editor-card">
      <h3>头像</h3>
      <div className="photo-actions">
        <button type="button" className="btn btn-light" onClick={openFilePicker}>
          上传照片
        </button>
        {photo?.src ? (
          <button type="button" className="btn btn-mini btn-danger" onClick={() => onPhotoChange(undefined)}>
            删除照片
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />
      {error ? <p className="error-text">{error}</p> : null}

      {isModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h4>裁剪头像（1:1）</h4>
            <div className="crop-preview-box">
              <img src={source} alt="裁剪预览" style={previewTransform} />
              <div className="crop-overlay" />
            </div>
            <div className="crop-controls">
              <label>
                缩放
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </label>
              <label>
                左右位置
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={offsetX}
                  onChange={(event) => setOffsetX(Number(event.target.value))}
                />
              </label>
              <label>
                上下位置
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={offsetY}
                  onChange={(event) => setOffsetY(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-light" onClick={resetEditor} disabled={saving}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={handleApply} disabled={saving}>
                {saving ? '处理中...' : '应用裁剪'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default PhotoUploader;
