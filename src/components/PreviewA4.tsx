import { useLayoutEffect, useRef } from 'react';
import type { ResumeState, WorkEntry, EducationEntry, ProjectEntry, AwardEntry, CertificateEntry } from '../types/resume';

interface PreviewA4Props {
  resume: ResumeState;
  fitScale: number;
  measureVersion: number;
  onMeasure: (naturalHeight: number, frameHeight: number) => void;
}

// Format date range for display
const formatDateRange = (start: string, end: string): string => {
  const startStr = start || '';
  const endStr = end === 'present' ? '至今' : (end || '');
  if (startStr && endStr) return `${startStr} - ${endStr}`;
  if (startStr) return startStr;
  return endStr;
};

const PreviewA4 = ({ resume, fitScale, measureVersion, onMeasure }: PreviewA4Props) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const rafId = requestAnimationFrame(() => {
      onMeasure(content.scrollHeight, frame.clientHeight);
    });

    return () => cancelAnimationFrame(rafId);
  }, [resume, fitScale, measureVersion, onMeasure]);

  const { personal } = resume;
  const shouldShowPhoto = resume.showPhoto && resume.photo?.src;

  // Build contact items array based on visibility toggles
  const contactItems: string[] = [];
  if (personal.email && resume.showEmail) contactItems.push(personal.email);
  if (personal.phone && resume.showPhone) contactItems.push(personal.phone);
  if (personal.url && resume.showUrl) contactItems.push(personal.url);
  if (resume.showProfiles) {
    personal.profiles?.forEach(p => {
      contactItems.push(`${p.network}: ${p.url}`);
    });
  }

  // Location string
  const locationParts: string[] = [];
  if (personal.location?.city) locationParts.push(personal.location.city);
  if (personal.location?.region) locationParts.push(personal.location.region);
  const locationStr = locationParts.join(', ');

  return (
    <section className="preview-panel" id="print-root">
      <div className="a4-stage">
        <div className="a4-page" ref={frameRef}>
          <div className="a4-content" ref={contentRef} style={{ transform: `scale(${fitScale})` }}>
            {/* Header - imprecv style */}
            <header className={shouldShowPhoto ? 'resume-header resume-header-with-photo' : 'resume-header'}>
              <div className="header-content">
                {resume.showName && <h1>{personal.name}</h1>}

                {personal.titles && personal.titles.length > 0 && resume.showTitle && (
                  <div className="resume-titles">
                    {personal.titles.join(' / ')}
                  </div>
                )}

                {locationStr && resume.showAddress && (
                  <div className="resume-location">{locationStr}</div>
                )}

                {contactItems.length > 0 && (
                  <div className="resume-contact">
                    {contactItems.map((item, index) => (
                      <span key={index} className="contact-item">
                        {item}
                        {index < contactItems.length - 1 && (
                          <span className="separator">◆</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {personal.summary && resume.showSummary && (
                  <div className="resume-summary">{personal.summary}</div>
                )}
              </div>

              {shouldShowPhoto && (
                <div className="avatar-box">
                  <img src={resume.photo!.src} alt="头像" />
                </div>
              )}
            </header>

            {/* Sections */}
            {resume.sections
              .filter((section) => section.visible)
              .map((section) => (
                <section className="resume-section" key={section.id}>
                  <h2>{section.title}</h2>

                  {/* Work Experience */}
                  {section.type === 'work' && section.workEntries && (
                    <div className="entries">
                      {section.workEntries.map((entry: WorkEntry) => (
                        <div key={entry.id} className="entry">
                          <div className="entry-line1">
                            <span className="entry-org">{entry.organization}</span>
                            <span className="entry-location">{entry.location}</span>
                          </div>
                          {entry.positions.map((pos) => (
                            <div key={pos.id}>
                              <div className="entry-line2">
                                <span className="entry-position">{pos.position}</span>
                                <span className="entry-date">{formatDateRange(pos.startDate, pos.endDate)}</span>
                              </div>
                              {pos.highlights.length > 0 && pos.highlights[0] && (
                                <ul className="entry-highlights">
                                  {pos.highlights.filter(h => h.trim()).map((highlight, idx) => (
                                    <li key={idx}>{highlight}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Education */}
                  {section.type === 'education' && section.educationEntries && (
                    <div className="entries">
                      {section.educationEntries.map((entry: EducationEntry) => {
                        const honorsLabel = (entry.honorsLabel || '荣誉').trim() || '荣誉';
                        return (
                          <div key={entry.id} className="entry">
                            <div className="entry-line1">
                              <span className="entry-org">{entry.institution}</span>
                              <span className="entry-location">{entry.location}</span>
                            </div>
                            <div className="entry-line2">
                              <span className="edu-degree">
                                {entry.studyType}
                                {entry.area && ` - ${entry.area}`}
                              </span>
                              <span className="entry-date">{formatDateRange(entry.startDate, entry.endDate)}</span>
                            </div>
                            {(entry.honors?.length || entry.courses?.length || entry.highlights?.length) && (
                              <div className="edu-details">
                                {entry.honors && entry.honors.length > 0 && (
                                  <div className="detail-item">
                                    <strong>{honorsLabel}：</strong>{entry.honors.join('，')}
                                  </div>
                                )}
                                {entry.courses && entry.courses.length > 0 && (
                                  <div className="detail-item">
                                    <strong>课程：</strong>{entry.courses.join('，')}
                                  </div>
                                )}
                                {entry.highlights && entry.highlights.length > 0 && entry.highlights[0] && (
                                  <ul className="entry-highlights">
                                    {entry.highlights.filter(h => h.trim()).map((highlight, idx) => (
                                      <li key={idx}>{highlight}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Projects */}
                  {section.type === 'project' && section.projectEntries && (
                    <div className="entries">
                      {section.projectEntries.map((entry: ProjectEntry) => (
                        <div key={entry.id} className="entry">
                          <div className="entry-line1">
                            <span className="entry-org">{entry.name}</span>
                          </div>
                          <div className="entry-line2">
                            <span className="entry-position">{entry.affiliation}</span>
                            <span className="entry-date">{formatDateRange(entry.startDate, entry.endDate)}</span>
                          </div>
                          {entry.highlights.length > 0 && entry.highlights[0] && (
                            <ul className="entry-highlights">
                              {entry.highlights.filter(h => h.trim()).map((highlight, idx) => (
                                <li key={idx}>{highlight}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Awards */}
                  {section.type === 'awards' && section.awardEntries && (
                    <div className="entries">
                      {section.awardEntries.map((entry: AwardEntry) => (
                        <div key={entry.id} className="entry">
                          <div className="award-line1">
                            <span className="award-title">{entry.title}</span>
                            <span className="entry-date">{entry.date}</span>
                          </div>
                          <div className="award-issuer">
                            <em>{entry.issuer}</em>
                            {entry.location && ` · ${entry.location}`}
                          </div>
                          {entry.highlights && entry.highlights.length > 0 && entry.highlights[0] && (
                            <ul className="entry-highlights">
                              {entry.highlights.filter(h => h.trim()).map((highlight, idx) => (
                                <li key={idx}>{highlight}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Certificates */}
                  {section.type === 'certs' && section.certificateEntries && (
                    <div className="entries">
                      {section.certificateEntries.map((entry: CertificateEntry) => (
                        <div key={entry.id} className="entry">
                          <div className="cert-line1">
                            <span className="cert-name">{entry.name}</span>
                            <span className="entry-date">{entry.date}</span>
                          </div>
                          <div className="cert-issuer">
                            <em>{entry.issuer}</em>
                            {entry.id && ` · ID: ${entry.id}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skills */}
                  {section.type === 'skills' && (
                    <div className="skills-content">
                      {section.languages && section.languages.length > 0 && (
                        <div className="skill-category">
                          <span className="skill-label">语言：</span>
                          {section.languages.map(l => `${l.language} (${l.fluency})`).join('，')}
                        </div>
                      )}
                      {section.skillGroups?.map((group, idx) => (
                        <div key={idx} className="skill-category">
                          <span className="skill-label">{group.category}：</span>
                          {group.skills.join('，')}
                        </div>
                      ))}
                      {section.interests && section.interests.length > 0 && (
                        <div className="skill-category">
                          <span className="skill-label">兴趣爱好：</span>
                          {section.interests.join('，')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom/Legacy sections */}
                  {section.items && section.items.length > 0 && (
                    <div className="custom-content">
                      {section.items
                        .map((item) => item.text.trim())
                        .filter(Boolean)
                        .map((text, index) => (
                          <div key={index} style={{ marginBottom: '4px' }}>{text}</div>
                        ))}
                    </div>
                  )}
                </section>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PreviewA4;
