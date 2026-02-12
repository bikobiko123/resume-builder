import { useState } from 'react';
import {
  createCustomItem,
  createEducationEntry,
  createPosition,
  createProjectEntry,
  createWorkEntry,
  type ResumeState,
  type ResumeSection,
  type SectionType,
  type WorkEntry,
  type EducationEntry,
  type ProjectEntry,
} from '../types/resume';
import PhotoUploader from './PhotoUploader';

interface EditorPanelProps {
  resume: ResumeState;
  onUpdatePersonal: (updates: Partial<ResumeState['personal']>) => void;
  onPhotoChange: (photo?: ResumeState['photo']) => void;
  onToggleShowPhoto: () => void;
  onToggleShowName: () => void;
  onToggleShowEmail: () => void;
  onToggleShowPhone: () => void;
  onToggleShowUrl: () => void;
  onToggleShowProfiles: () => void;
  onToggleShowAddress: () => void;
  onToggleShowTitle: () => void;
  onToggleShowSummary: () => void;
  onAddSection: (type: SectionType) => void;
  onRemoveSection: (sectionId: string) => void;
  onMoveSection: (index: number, direction: 'up' | 'down') => void;
  onToggleVisible: (sectionId: string) => void;
  onSectionTitleChange: (sectionId: string, title: string) => void;
  onUpdateSection: (sectionId: string, updates: Partial<ResumeSection>) => void;
}

const sectionTypeOptions: { value: SectionType; label: string }[] = [
  { value: 'work', label: '工作经历' },
  { value: 'education', label: '教育背景' },
  { value: 'project', label: '项目经历' },
  { value: 'skills', label: '技能' },
  { value: 'certs', label: '证书' },
  { value: 'awards', label: '奖项' },
  { value: 'affiliations', label: '社团经历' },
  { value: 'custom', label: '自定义' },
];

const EditorPanel = ({
  resume,
  onUpdatePersonal,
  onPhotoChange,
  onToggleShowPhoto,
  onToggleShowName,
  onToggleShowEmail,
  onToggleShowPhone,
  onToggleShowUrl,
  onToggleShowProfiles,
  onToggleShowAddress,
  onToggleShowTitle,
  onToggleShowSummary,
  onAddSection,
  onRemoveSection,
  onMoveSection,
  onToggleVisible,
  onSectionTitleChange,
  onUpdateSection,
}: EditorPanelProps) => {
  const [sectionType, setSectionType] = useState<SectionType>('work');
  const { personal } = resume;

  return (
    <aside className="editor-panel no-print">
      {/* Personal Information */}
      <section className="editor-card">
        <div className="section-title-line">
          <h3>个人信息</h3>
        </div>

        <div className="field-grid">
          <div className="field-with-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={resume.showName}
                onChange={onToggleShowName}
              />
              姓名
            </label>
            <input
              className="text-input"
              value={personal.name}
              onChange={(e) => onUpdatePersonal({ name: e.target.value })}
              placeholder="张三"
            />
          </div>
          <div className="field-with-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={resume.showEmail}
                onChange={onToggleShowEmail}
              />
              邮箱
            </label>
            <input
              className="text-input"
              value={personal.email || ''}
              onChange={(e) => onUpdatePersonal({ email: e.target.value })}
              placeholder="zhangsan@email.com"
            />
          </div>
          <div className="field-with-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={resume.showPhone}
                onChange={onToggleShowPhone}
              />
              电话
            </label>
            <input
              className="text-input"
              value={personal.phone || ''}
              onChange={(e) => onUpdatePersonal({ phone: e.target.value })}
              placeholder="138-0000-0000"
            />
          </div>
          <div className="field-with-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={resume.showUrl}
                onChange={onToggleShowUrl}
              />
              个人网站
            </label>
            <input
              className="text-input"
              value={personal.url || ''}
              onChange={(e) => onUpdatePersonal({ url: e.target.value })}
              placeholder="https://zhangsan.dev"
            />
          </div>
          <div className="field-with-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={resume.showAddress}
                onChange={onToggleShowAddress}
              />
              城市
            </label>
            <input
              className="text-input"
              value={personal.location?.city || ''}
              onChange={(e) =>
                onUpdatePersonal({
                  location: { ...personal.location, city: e.target.value },
                })
              }
              placeholder="上海"
            />
          </div>
          <div className="field-with-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={resume.showAddress}
                onChange={onToggleShowAddress}
                disabled
              />
              地区
            </label>
            <input
              className="text-input"
              value={personal.location?.region || ''}
              onChange={(e) =>
                onUpdatePersonal({
                  location: { ...personal.location, region: e.target.value },
                })
              }
              placeholder="浦东新区"
            />
          </div>
        </div>

        <div className="field-with-toggle" style={{ marginTop: '10px' }}>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={resume.showTitle}
              onChange={onToggleShowTitle}
            />
            职位头衔（用 / 分隔）
          </label>
          <input
            className="text-input"
            value={personal.titles?.join(' / ') || ''}
            onChange={(e) =>
              onUpdatePersonal({
                titles: e.target.value.split('/').map((t) => t.trim()),
              })
            }
            placeholder="产品经理 / 数据分析师"
          />
        </div>

        <div className="field-with-toggle" style={{ marginTop: '10px' }}>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={resume.showSummary}
              onChange={onToggleShowSummary}
            />
            个人简介
          </label>
          <textarea
            className="text-area"
            rows={3}
            value={personal.summary || ''}
            onChange={(e) => onUpdatePersonal({ summary: e.target.value })}
            placeholder="简要介绍你的专业背景..."
          />
        </div>

        {/* Social Profiles */}
        <div style={{ marginTop: '10px' }}>
          <div className="toggle-label" style={{ marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={resume.showProfiles}
              onChange={onToggleShowProfiles}
            />
            <span>社交链接</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(personal.profiles || []).map((profile, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="text-input"
                  style={{ width: '100px' }}
                  value={profile.network}
                  onChange={(e) => {
                    const newProfiles = [...(personal.profiles || [])];
                    newProfiles[idx] = { ...profile, network: e.target.value };
                    onUpdatePersonal({ profiles: newProfiles });
                  }}
                  placeholder="平台"
                />
                <input
                  className="text-input"
                  style={{ flex: 1 }}
                  value={profile.url}
                  onChange={(e) => {
                    const newProfiles = [...(personal.profiles || [])];
                    newProfiles[idx] = { ...profile, url: e.target.value };
                    onUpdatePersonal({ profiles: newProfiles });
                  }}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  className="btn btn-mini btn-danger"
                  onClick={() => {
                    const newProfiles = (personal.profiles || []).filter((_, i) => i !== idx);
                    onUpdatePersonal({ profiles: newProfiles });
                  }}
                >
                  删除
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-light"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                const newProfiles = [...(personal.profiles || []), { network: '', username: '', url: '' }];
                onUpdatePersonal({ profiles: newProfiles });
              }}
            >
              + 添加社交链接
            </button>
          </div>
        </div>
      </section>

      {/* Photo */}
      <section className="editor-card">
        <div className="section-title-line">
          <h3>头像</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <input type="checkbox" checked={resume.showPhoto} onChange={onToggleShowPhoto} />
            显示头像
          </label>
        </div>
        <PhotoUploader photo={resume.photo} onPhotoChange={onPhotoChange} />
      </section>

      {/* Add Section */}
      <section className="editor-card">
        <div className="section-title-line">
          <h3>添加模块</h3>
          <div className="inline-add-controls">
            <select value={sectionType} onChange={(e) => setSectionType(e.target.value as SectionType)}>
              {sectionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-light" onClick={() => onAddSection(sectionType)}>
              + 添加
            </button>
          </div>
        </div>
      </section>

      {/* Sections */}
      {resume.sections.map((section, index) => (
        <SectionEditor
          key={section.id}
          section={section}
          index={index}
          total={resume.sections.length}
          onTitleChange={onSectionTitleChange}
          onToggleVisible={onToggleVisible}
          onMoveSection={onMoveSection}
          onRemoveSection={onRemoveSection}
          onUpdateSection={onUpdateSection}
        />
      ))}
    </aside>
  );
};

// Section Editor Component
interface SectionEditorProps {
  section: ResumeSection;
  index: number;
  total: number;
  onTitleChange: (sectionId: string, title: string) => void;
  onToggleVisible: (sectionId: string) => void;
  onMoveSection: (index: number, direction: 'up' | 'down') => void;
  onRemoveSection: (sectionId: string) => void;
  onUpdateSection: (sectionId: string, updates: Partial<ResumeSection>) => void;
}

const SectionEditor = ({
  section,
  index,
  total,
  onTitleChange,
  onToggleVisible,
  onMoveSection,
  onRemoveSection,
  onUpdateSection,
}: SectionEditorProps) => {
  return (
    <section className="editor-card">
      <div className="section-title-line">
        <input
          className="text-input"
          value={section.title}
          onChange={(e) => onTitleChange(section.id, e.target.value)}
          style={{ fontWeight: 600, flex: 1 }}
        />
        <div className="section-controls">
          <button
            type="button"
            className="btn btn-mini btn-light"
            onClick={() => onMoveSection(index, 'up')}
            disabled={index === 0}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-mini btn-light"
            onClick={() => onMoveSection(index, 'down')}
            disabled={index === total - 1}
          >
            ↓
          </button>
          <button type="button" className="btn btn-mini btn-light" onClick={() => onToggleVisible(section.id)}>
            {section.visible ? '隐藏' : '显示'}
          </button>
          <button type="button" className="btn btn-mini btn-danger" onClick={() => onRemoveSection(section.id)}>
            删除
          </button>
        </div>
      </div>

      {/* Work Experience Editor */}
      {section.type === 'work' && (
        <WorkEditor section={section} onUpdateSection={onUpdateSection} />
      )}

      {/* Education Editor */}
      {section.type === 'education' && (
        <EducationEditor section={section} onUpdateSection={onUpdateSection} />
      )}

      {/* Project Editor */}
      {section.type === 'project' && (
        <ProjectEditor section={section} onUpdateSection={onUpdateSection} />
      )}

      {/* Skills Editor */}
      {section.type === 'skills' && <SkillsEditor section={section} onUpdateSection={onUpdateSection} />}

      {/* Custom Section Editor */}
      {section.type === 'custom' && (
        <CustomEditor section={section} onUpdateSection={onUpdateSection} />
      )}
    </section>
  );
};

// Work Experience Editor
const WorkEditor = ({
  section,
  onUpdateSection,
}: {
  section: ResumeSection;
  onUpdateSection: (sectionId: string, updates: Partial<ResumeSection>) => void;
}) => {
  const entries = section.workEntries || [];

  const updateEntry = (entryId: string, updates: Partial<WorkEntry>) => {
    const newEntries = entries.map((e) => (e.id === entryId ? { ...e, ...updates } : e));
    onUpdateSection(section.id, { workEntries: newEntries });
  };

  const removeEntry = (entryId: string) => {
    const newEntries = entries.filter((e) => e.id !== entryId);
    onUpdateSection(section.id, { workEntries: newEntries });
  };

  const addEntry = () => {
    onUpdateSection(section.id, { workEntries: [...entries, createWorkEntry()] });
  };

  const updatePosition = (entryId: string, positionId: string, updates: any) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const newPositions = entry.positions.map((p) => (p.id === positionId ? { ...p, ...updates } : p));
    updateEntry(entryId, { positions: newPositions });
  };

  const addPosition = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { positions: [...entry.positions, createPosition()] });
  };

  return (
    <div style={{ marginTop: '10px' }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            border: '1px solid #e5ebf2',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '10px',
            background: '#fbfcfe',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="text-input"
              placeholder="公司名称"
              value={entry.organization}
              onChange={(e) => updateEntry(entry.id, { organization: e.target.value })}
              style={{ flex: 1 }}
            />
            <input
              className="text-input"
              placeholder="地点"
              value={entry.location}
              onChange={(e) => updateEntry(entry.id, { location: e.target.value })}
              style={{ width: '100px' }}
            />
            <button type="button" className="btn btn-mini btn-danger" onClick={() => removeEntry(entry.id)}>
              删除
            </button>
          </div>

          {entry.positions.map((pos) => (
            <div
              key={pos.id}
              style={{
                marginTop: '8px',
                padding: '8px',
                background: '#f0f4f8',
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <input
                  className="text-input"
                  placeholder="职位"
                  value={pos.position}
                  onChange={(e) => updatePosition(entry.id, pos.id, { position: e.target.value })}
                  style={{ flex: 1 }}
                />
                <input
                  className="text-input"
                  placeholder="开始时间"
                  value={pos.startDate}
                  onChange={(e) => updatePosition(entry.id, pos.id, { startDate: e.target.value })}
                  style={{ width: '80px' }}
                />
                <input
                  className="text-input"
                  placeholder="结束时间"
                  value={pos.endDate}
                  onChange={(e) => updatePosition(entry.id, pos.id, { endDate: e.target.value })}
                  style={{ width: '80px' }}
                />
              </div>
              {pos.highlights.map((highlight, hidx) => (
                <textarea
                  key={hidx}
                  className="text-area"
                  rows={2}
                  placeholder="工作内容描述"
                  value={highlight}
                  onChange={(e) => {
                    const newHighlights = [...pos.highlights];
                    newHighlights[hidx] = e.target.value;
                    updatePosition(entry.id, pos.id, { highlights: newHighlights });
                  }}
                  style={{ marginBottom: '4px', width: '100%' }}
                />
              ))}
              <button type="button" className="btn btn-mini btn-light" onClick={() => addPosition(entry.id)}>
                + 添加职位（晋升）
              </button>
            </div>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="btn btn-light"
        onClick={addEntry}
      >
        + 添加工作经历
      </button>
    </div>
  );
};

// Education Editor
const EducationEditor = ({
  section,
  onUpdateSection,
}: {
  section: ResumeSection;
  onUpdateSection: (sectionId: string, updates: Partial<ResumeSection>) => void;
}) => {
  const entries = section.educationEntries || [];

  const updateEntry = (entryId: string, updates: Partial<EducationEntry>) => {
    const newEntries = entries.map((e) => (e.id === entryId ? { ...e, ...updates } : e));
    onUpdateSection(section.id, { educationEntries: newEntries });
  };

  const removeEntry = (entryId: string) => {
    const newEntries = entries.filter((e) => e.id !== entryId);
    onUpdateSection(section.id, { educationEntries: newEntries });
  };

  const addEntry = () => {
    onUpdateSection(section.id, { educationEntries: [...entries, createEducationEntry()] });
  };

  return (
    <div style={{ marginTop: '10px' }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            border: '1px solid #e5ebf2',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '10px',
            background: '#fbfcfe',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="text-input"
              placeholder="学校名称"
              value={entry.institution}
              onChange={(e) => updateEntry(entry.id, { institution: e.target.value })}
              style={{ flex: 1 }}
            />
            <input
              className="text-input"
              placeholder="地点"
              value={entry.location}
              onChange={(e) => updateEntry(entry.id, { location: e.target.value })}
              style={{ width: '100px' }}
            />
            <button type="button" className="btn btn-mini btn-danger" onClick={() => removeEntry(entry.id)}>
              删除
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="text-input"
              placeholder="学位"
              value={entry.studyType}
              onChange={(e) => updateEntry(entry.id, { studyType: e.target.value })}
              style={{ flex: 1 }}
            />
            <input
              className="text-input"
              placeholder="专业"
              value={entry.area}
              onChange={(e) => updateEntry(entry.id, { area: e.target.value })}
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="text-input"
              placeholder="开始时间"
              value={entry.startDate}
              onChange={(e) => updateEntry(entry.id, { startDate: e.target.value })}
              style={{ width: '100px' }}
            />
            <input
              className="text-input"
              placeholder="结束时间"
              value={entry.endDate}
              onChange={(e) => updateEntry(entry.id, { endDate: e.target.value })}
              style={{ width: '100px' }}
            />
          </div>
          {/* Customizable honors/courses label */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="text-input"
                placeholder="字段名（如荣誉/课程）"
                value={entry.honorsLabel || '荣誉'}
                onChange={(e) => updateEntry(entry.id, { honorsLabel: e.target.value })}
                style={{ width: '140px' }}
              />
              <input
                className="text-input"
                placeholder={`${entry.honorsLabel || '荣誉'}（用 / 分隔）`}
                value={entry.honors?.join(' / ') || ''}
                onChange={(e) =>
                  updateEntry(entry.id, {
                    honors: e.target.value ? e.target.value.split('/').map((s) => s.trim()) : [],
                  })
                }
                style={{ flex: 1 }}
              />
            </div>
          </div>
          {/* Highlights */}
          <div>
            {(entry.highlights || []).map((highlight, hidx) => (
              <textarea
                key={hidx}
                className="text-area"
                rows={2}
                placeholder="亮点描述"
                value={highlight}
                onChange={(e) => {
                  const newHighlights = [...(entry.highlights || [])];
                  newHighlights[hidx] = e.target.value;
                  updateEntry(entry.id, { highlights: newHighlights });
                }}
                style={{ marginBottom: '4px', width: '100%' }}
              />
            ))}
            <button
              type="button"
              className="btn btn-mini btn-light"
              onClick={() => updateEntry(entry.id, { highlights: [...(entry.highlights || []), ''] })}
            >
              + 添加亮点
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-light"
        onClick={addEntry}
      >
        + 添加教育经历
      </button>
    </div>
  );
};

// Project Editor
const ProjectEditor = ({
  section,
  onUpdateSection,
}: {
  section: ResumeSection;
  onUpdateSection: (sectionId: string, updates: Partial<ResumeSection>) => void;
}) => {
  const entries = section.projectEntries || [];

  const updateEntry = (entryId: string, updates: Partial<ProjectEntry>) => {
    const newEntries = entries.map((e) => (e.id === entryId ? { ...e, ...updates } : e));
    onUpdateSection(section.id, { projectEntries: newEntries });
  };

  const removeEntry = (entryId: string) => {
    const newEntries = entries.filter((e) => e.id !== entryId);
    onUpdateSection(section.id, { projectEntries: newEntries });
  };

  const addEntry = () => {
    onUpdateSection(section.id, { projectEntries: [...entries, createProjectEntry()] });
  };

  return (
    <div style={{ marginTop: '10px' }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            border: '1px solid #e5ebf2',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '10px',
            background: '#fbfcfe',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="text-input"
              placeholder="项目名称"
              value={entry.name}
              onChange={(e) => updateEntry(entry.id, { name: e.target.value })}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-mini btn-danger" onClick={() => removeEntry(entry.id)}>
              删除
            </button>
          </div>
          <input
            className="text-input"
            placeholder="所属机构"
            value={entry.affiliation || ''}
            onChange={(e) => updateEntry(entry.id, { affiliation: e.target.value })}
            style={{ marginBottom: '8px', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="text-input"
              placeholder="开始时间"
              value={entry.startDate}
              onChange={(e) => updateEntry(entry.id, { startDate: e.target.value })}
              style={{ width: '100px' }}
            />
            <input
              className="text-input"
              placeholder="结束时间"
              value={entry.endDate}
              onChange={(e) => updateEntry(entry.id, { endDate: e.target.value })}
              style={{ width: '100px' }}
            />
          </div>
          {entry.highlights.map((highlight, idx) => (
            <textarea
              key={idx}
              className="text-area"
              rows={2}
              placeholder="项目描述"
              value={highlight}
              onChange={(e) => {
                const newHighlights = [...entry.highlights];
                newHighlights[idx] = e.target.value;
                updateEntry(entry.id, { highlights: newHighlights });
              }}
              style={{ marginBottom: '4px', width: '100%' }}
            />
          ))}
          <button
            type="button"
            className="btn btn-mini btn-light"
            onClick={() => updateEntry(entry.id, { highlights: [...entry.highlights, ''] })}
          >
            + 添加描述
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-light"
        onClick={addEntry}
      >
        + 添加项目经历
      </button>
    </div>
  );
};

// Skills Editor
const SkillsEditor = ({
  section,
  onUpdateSection,
}: {
  section: ResumeSection;
  onUpdateSection: (sectionId: string, updates: Partial<ResumeSection>) => void;
}) => {
  const skillGroups = section.skillGroups || [];
  const languages = section.languages || [];

  return (
    <div style={{ marginTop: '10px' }}>
      <label style={{ display: 'block', marginBottom: '8px' }}>
        技能（格式：类别: 技能1, 技能2）
        <textarea
          className="text-area"
          rows={4}
          value={skillGroups
            .map((g) => `${g.category}: ${g.skills.join(', ')}`)
            .join('\n')}
          onChange={(e) => {
            const lines = e.target.value.split('\n');
            const newGroups = lines
              .filter((l) => l.trim())
              .map((line) => {
                const [category, skillsStr] = line.split(':');
                return {
                  category: category?.trim() || '',
                  skills: skillsStr?.split(',').map((s) => s.trim()) || [],
                };
              });
            onUpdateSection(section.id, { skillGroups: newGroups });
          }}
          placeholder="产品工具: Axure, Figma, Sketch&#10;数据分析: SQL, Python, Excel"
        />
      </label>
      <label style={{ display: 'block' }}>
        语言（格式：语言 - 熟练度）
        <input
          className="text-input"
          value={languages.map((l) => `${l.language} - ${l.fluency}`).join(', ')}
          onChange={(e) => {
            const parts = e.target.value.split(',');
            const newLangs = parts
              .map((p) => {
                const [lang, fluency] = p.split('-');
                return {
                  language: lang?.trim() || '',
                  fluency: fluency?.trim() || '',
                };
              })
              .filter((l) => l.language);
            onUpdateSection(section.id, { languages: newLangs });
          }}
          placeholder="中文 - 母语, 英语 - 流利"
        />
      </label>
    </div>
  );
};

// Custom Section Editor
const CustomEditor = ({
  section,
  onUpdateSection,
}: {
  section: ResumeSection;
  onUpdateSection: (sectionId: string, updates: Partial<ResumeSection>) => void;
}) => {
  const items = section.items || [];

  return (
    <div style={{ marginTop: '10px' }}>
      {items.map((item, idx) => (
        <div key={item.id} style={{ marginBottom: '8px' }}>
          <textarea
            className="text-area"
            rows={2}
            value={item.text}
            onChange={(e) => {
              const newItems = [...items];
              newItems[idx] = { ...item, text: e.target.value };
              onUpdateSection(section.id, { items: newItems });
            }}
            placeholder="输入内容"
          />
        </div>
      ))}
      <button
        type="button"
        className="btn btn-light"
        onClick={() => {
          onUpdateSection(section.id, {
            items: [...items, createCustomItem()],
          });
        }}
      >
        + 添加条目
      </button>
    </div>
  );
};

export default EditorPanel;
