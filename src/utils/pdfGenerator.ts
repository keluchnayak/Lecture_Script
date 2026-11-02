import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { LectureNotes } from '../types';
import { formatHtmlMarkdown } from '../components/FormattedText';

/**
 * Converts LectureNotes into a high-resolution, multi-page PDF file directly.
 * The file is downloaded as [Course]_College_Exam_Notes.pdf.
 */
export async function downloadNotesAsPdf(notes: LectureNotes): Promise<void> {
  const safeTitle = (notes.title || 'Lecture_Notes')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const fileName = `${safeTitle}_Study_Notes.pdf`;

  // Create an off-screen container formatted specifically for standard A4 document printing
  const container = document.createElement('div');
  container.id = 'pdf-render-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.padding = '36px 40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1c1917';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  container.style.fontSize = '13px';
  container.style.lineHeight = '1.6';
  container.style.zIndex = '-999';

  // Build the clean study notes document HTML
  const modulesHtml = (notes.modules || []).map((m, idx) => `
    <div style="border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; background-color: #fafaf9; page-break-inside: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-size: 10px; font-weight: bold; background-color: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">
          ${m.importance || 'Key Topic'}
        </span>
        <span style="font-size: 11px; color: #78716c;">Topic ${idx + 1}</span>
      </div>
      <h3 style="margin: 2px 0 2px 0; font-size: 15px; font-weight: 800; color: #0c0a09;">
        ${formatHtmlMarkdown(m.topic)}
      </h3>
      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #78716c; margin-bottom: 8px;">
        ${formatHtmlMarkdown(m.subheading)}
      </div>
      <p style="margin: 0 0 10px 0; color: #292524; font-size: 12.5px; line-height: 1.5;">
        ${formatHtmlMarkdown(m.coreExplanation)}
      </p>
      <div style="margin: 8px 0; padding-left: 4px;">
        ${(m.keyPoints || []).map((p) => `
          <div style="display: flex; align-items: flex-start; margin-bottom: 6px; font-size: 12px; color: #1c1917;">
            <span style="color: #059669; font-weight: bold; margin-right: 6px; line-height: 1;">&bull;</span>
            <div style="line-height: 1.5;">${formatHtmlMarkdown(p)}</div>
          </div>
        `).join('')}
      </div>
      ${m.exampleOrCaseStudy ? `
        <div style="background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 6px; padding: 8px 10px; margin-top: 8px; font-size: 11.5px; color: #44403c;">
          <strong style="color: #0c0a09;">📌 Real-World Example:</strong> ${formatHtmlMarkdown(m.exampleOrCaseStudy)}
        </div>
      ` : ''}
    </div>
  `).join('');

  const formulasHtml = (notes.keyFormulasOrDefinitions || []).map((f) => `
    <div style="border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; background-color: #f0fdf4; margin-bottom: 10px; page-break-inside: avoid;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #065f46;">
        ${formatHtmlMarkdown(f.term)}
      </div>
      <div style="background-color: #ffffff; border: 1px solid #d1fae5; border-radius: 6px; padding: 6px 10px; font-family: monospace; font-size: 12px; font-weight: bold; color: #064e3b; margin: 6px 0;">
        ${f.formulaOrDefinition}
      </div>
      <div style="font-size: 11px; color: #047857; margin-bottom: 2px;">
        <strong>How to use it:</strong> ${formatHtmlMarkdown(f.context)}
      </div>
      ${f.examSignificance ? `
        <div style="font-size: 11px; color: #065f46; font-weight: 500;">
          <strong>Why it matters:</strong> ${formatHtmlMarkdown(f.examSignificance)}
        </div>
      ` : ''}
    </div>
  `).join('');

  const comparisonsHtml = (notes.comparisonAnalysis || []).map((c) => `
    <tr style="border-bottom: 1px solid #e7e5e4;">
      <td style="padding: 8px 10px; font-weight: bold; color: #1c1917; font-size: 11.5px;">${formatHtmlMarkdown(c.aspect)}</td>
      <td style="padding: 8px 10px; color: #44403c; font-size: 11.5px;">${formatHtmlMarkdown(c.conceptA)}</td>
      <td style="padding: 8px 10px; color: #44403c; font-size: 11.5px;">${formatHtmlMarkdown(c.conceptB)}</td>
      <td style="padding: 8px 10px; color: #065f46; font-weight: 600; font-size: 11.5px;">${formatHtmlMarkdown(c.keyDifference)}</td>
    </tr>
  `).join('');

  const trapsHtml = (notes.examTrapsAndAlerts || []).map((t, idx) => `
    <div style="border-left: 4px solid #f59e0b; background-color: #fffbeb; border-radius: 0 8px 8px 0; padding: 10px 14px; margin-bottom: 10px; page-break-inside: avoid;">
      <div style="font-size: 11.5px; font-weight: 800; color: #92400e; margin-bottom: 4px;">
        Mistake #${idx + 1}: ${formatHtmlMarkdown(t.topic)}
      </div>
      <div style="font-size: 11.5px; color: #78350f; margin-bottom: 4px;">
        <strong>Common mistake:</strong> ${formatHtmlMarkdown(t.trapDescription)}
      </div>
      <div style="font-size: 11.5px; color: #065f46; background-color: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #fde68a;">
        <strong>How to get full points:</strong> ${formatHtmlMarkdown(t.howToAnswerInExam)}
      </div>
    </div>
  `).join('');

  const recallHtml = (notes.activeRecallQuestions || []).map((q, idx) => `
    <div style="border: 1px solid #e7e5e4; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; background-color: #fafaf9; page-break-inside: avoid;">
      <div style="font-size: 12px; font-weight: bold; color: #1c1917; margin-bottom: 4px;">
        Q${idx + 1}: ${formatHtmlMarkdown(q.question)}
      </div>
      <div style="font-size: 11.5px; color: #065f46; background-color: #ecfdf5; padding: 6px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">
        <strong>Correct Answer:</strong> ${formatHtmlMarkdown(q.answerKey)}
      </div>
    </div>
  `).join('');

  const diagramsHtml = (notes.diagramsToDraw || []).map((d, idx) => `
    <div style="border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px; background-color: #fafaf9; margin-bottom: 12px; page-break-inside: avoid;">
      <div style="font-size: 12px; font-weight: bold; color: #1c1917; margin-bottom: 4px;">
        Figure ${idx + 1}: ${formatHtmlMarkdown(d.title)}
      </div>
      <div style="font-size: 11.5px; color: #57534e; margin-bottom: 6px;">
        <strong>How it works:</strong> ${formatHtmlMarkdown(d.instruction)}
      </div>
      ${d.asciiSketch ? `
        <pre style="background-color: #ffffff; border: 1px solid #d6d3d1; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 10.5px; overflow-x: auto; margin: 0; line-height: 1.4;">${d.asciiSketch}</pre>
      ` : ''}
    </div>
  `).join('');

  container.innerHTML = `
    <!-- Header -->
    <div style="border-bottom: 2.5px solid #0c0a09; padding-bottom: 14px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #78716c; margin-bottom: 6px;">
        <span>${notes.subject} &bull; ${notes.courseCodeOrTopic || 'Class Notes'}</span>
        <span>${notes.lectureDate}</span>
      </div>
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800; color: #0c0a09; line-height: 1.25;">
        ${notes.title}
      </h1>
      <div style="background-color: #f0fdf4; border-left: 3px solid #059669; padding: 8px 12px; font-style: italic; color: #166534; font-size: 12px; border-radius: 0 6px 6px 0;">
        ${formatHtmlMarkdown(notes.overview)}
      </div>
    </div>

    <!-- Modules Section -->
    ${modulesHtml ? `
      <div style="margin-bottom: 22px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #0c0a09; border-bottom: 1.5px solid #e7e5e4; padding-bottom: 4px; margin: 18px 0 12px 0;">
          📚 Key Topics & Explanations
        </h2>
        ${modulesHtml}
      </div>
    ` : ''}

    <!-- Formulas & Definitions Section -->
    ${formulasHtml ? `
      <div style="margin-bottom: 22px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #0c0a09; border-bottom: 1.5px solid #e7e5e4; padding-bottom: 4px; margin: 18px 0 12px 0;">
          📐 Key Formulas & Definitions
        </h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${formulasHtml}
        </div>
      </div>
    ` : ''}

    <!-- Comparative Analysis Section -->
    ${comparisonsHtml ? `
      <div style="margin-bottom: 22px; page-break-inside: avoid;">
        <h2 style="font-size: 16px; font-weight: 800; color: #0c0a09; border-bottom: 1.5px solid #e7e5e4; padding-bottom: 4px; margin: 18px 0 12px 0;">
          ⚖️ Side-by-Side Comparison
        </h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f5f5f4; border-bottom: 1px solid #d6d3d1; text-align: left;">
              <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #57534e;">Topic</th>
              <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #57534e;">Idea A</th>
              <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #57534e;">Idea B</th>
              <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #57534e;">Main Difference</th>
            </tr>
          </thead>
          <tbody>
            ${comparisonsHtml}
          </tbody>
        </table>
      </div>
    ` : ''}

    <!-- Common Mistakes to Avoid -->
    ${trapsHtml ? `
      <div style="margin-bottom: 22px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #92400e; border-bottom: 1.5px solid #fde68a; padding-bottom: 4px; margin: 18px 0 12px 0;">
          ⚠️ Common Mistakes to Avoid
        </h2>
        ${trapsHtml}
      </div>
    ` : ''}

    <!-- Diagrams & Sketches -->
    ${diagramsHtml ? `
      <div style="margin-bottom: 22px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #0c0a09; border-bottom: 1.5px solid #e7e5e4; padding-bottom: 4px; margin: 18px 0 12px 0;">
          ✏️ Diagrams & Sketches
        </h2>
        ${diagramsHtml}
      </div>
    ` : ''}

    <!-- Practice Questions -->
    ${recallHtml ? `
      <div style="margin-bottom: 22px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #0c0a09; border-bottom: 1.5px solid #e7e5e4; padding-bottom: 4px; margin: 18px 0 12px 0;">
          🧠 Practice Questions
        </h2>
        ${recallHtml}
      </div>
    ` : ''}

    <!-- Bottom Summary -->
    ${notes.bottomSummary ? `
      <div style="border-top: 1.5px solid #e7e5e4; padding-top: 12px; margin-top: 20px; font-size: 11.5px; color: #44403c; line-height: 1.5;">
        <strong style="color: #0c0a09;">Quick Summary:</strong> ${formatHtmlMarkdown(notes.bottomSummary)}
      </div>
    ` : ''}
  `;

  document.body.appendChild(container);

  try {
    // Wait for DOM to paint fonts/styles
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Capture the rendered container at 2x resolution for retina-crisp PDF output
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;

    // First page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Subsequent pages if content overflows A4 height
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Direct PDF file download
    pdf.save(fileName);
  } finally {
    // Clean up temporary DOM element
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
