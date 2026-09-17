const content = document.querySelector("#readme-content");
const nav = document.querySelector("#readme-nav-links");

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}

function inlineMarkdown(value) {
  const tokenPattern = /(`[^`]+`|\[[^\]]+\]\([^\s)]+(?:\s+"[^"]*")?\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let output = "";
  let cursor = 0;

  for (const match of value.matchAll(tokenPattern)) {
    output += escapeHtml(value.slice(cursor, match.index));
    const token = match[0];

    if (token.startsWith("`")) {
      output += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)$/);
      const url = linkMatch?.[2] || "#";
      const safeUrl = /^(https?:\/\/|README\.md(?:$|#)|index\.html(?:$|#))/.test(url) ? url : "#";
      output += `<a href="${escapeHtml(safeUrl)}">${escapeHtml(linkMatch?.[1] || token)}</a>`;
    } else if (token.startsWith("**") || token.startsWith("__")) {
      output += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else {
      output += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    }

    cursor = match.index + token.length;
  }

  return output + escapeHtml(value.slice(cursor));
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderTable(lines, start) {
  const headers = tableCells(lines[start]);
  const rows = [];
  let index = start + 2;
  while (index < lines.length && lines[index].includes("|")) {
    rows.push(tableCells(lines[index]));
    index += 1;
  }

  const head = headers.map((cell) => `<th scope="col">${inlineMarkdown(cell)}</th>`).join("");
  const body = rows.map((row) => {
    const cells = headers.map((_, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] || "")}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return { html: `<div class="readme-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`, next: index };
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  const headings = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2];
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      headings.push({ level, title, id });
      output.push(`<h${level} id="${id}">${inlineMarkdown(title)}</h${level}>`);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      const table = renderTable(lines, index);
      output.push(table.html);
      index = table.next;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(`<li>${inlineMarkdown(lines[index].replace(/^\s*[-*+]\s+/, ""))}</li>`);
        index += 1;
      }
      output.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      output.push("<hr />");
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^\s*```/.test(lines[index]) && !/^#{1,3}\s+/.test(lines[index]) && !/^\s*[-*+]\s+/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }

  nav.innerHTML = headings
    .filter(({ level }) => level === 2)
    .map(({ title, id }) => `<a href="#${id}">${inlineMarkdown(title)}</a>`)
    .join("");
  return output.join("\n");
}

try {
  const response = await fetch("README.md", { cache: "no-store" });
  if (!response.ok) throw new Error(`README.md returned ${response.status}`);
  content.innerHTML = renderMarkdown(await response.text());
} catch (error) {
  content.innerHTML = `<div class="readme-error"><p>README.md could not be loaded.</p><p><a href="README.md">open the raw README.md file</a></p></div>`;
  console.error(error);
}
