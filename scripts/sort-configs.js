#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function log() {}

function logSuccess(message) {
  log(`✅ ${message}`);
}

function logError(message) {
  log(`❌ ${message}`);
}

function sortObjectKeys(obj) {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return obj;
  }

  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = sortObjectKeys(obj[key]);
    });

  return sorted;
}

function sortDefaultDesignSettings(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");

    const regex = /export const defaultDesignSettings: DesignSettings = \{([\s\S]*?)\};/;
    const match = content.match(regex);

    if (match) {
      const objectContent = match[1];

      const lines = objectContent.split("\n");
      const properties = [];
      const comments = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("//")) {
          comments.push(trimmed);
          continue;
        }

        if (trimmed.includes(":") && !trimmed.startsWith("//")) {
          const cleanLine = trimmed.replace(/,+$/, "");
          properties.push(cleanLine);
        }
      }

      const propertyMap = {};

      for (const prop of properties) {
        if (prop.includes(":")) {
          const colonIndex = prop.indexOf(":");
          const key = prop.substring(0, colonIndex).trim();
          const value = prop.substring(colonIndex + 1).trim();
          propertyMap[key] = value;
        }
      }

      const sortedKeys = Object.keys(propertyMap).sort();

      let newObjectContent = "\n";

      comments.forEach((comment) => {
        newObjectContent += "  " + comment + "\n";
      });

      sortedKeys.forEach((key, index) => {
        const isLast = index === sortedKeys.length - 1;
        const comma = isLast ? "" : ",";
        newObjectContent += `  ${key}: ${propertyMap[key]}${comma}\n`;
      });

      const newContent = content.replace(regex, `export const defaultDesignSettings: DesignSettings = {${newObjectContent}};`);

      fs.writeFileSync(filePath, newContent, "utf8");
      logSuccess(`Sorted defaultDesignSettings in ${path.relative(process.cwd(), filePath)}`);
      return true;
    } else {
      logError(`Could not find defaultDesignSettings in ${filePath}`);
      return false;
    }
  } catch (error) {
    logError(`Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

function main() {
  const root = repoRoot();
  const files = [
    path.join(root, "adv-designer", "src", "types", "design.ts"),
    path.join(root, "adv-widget", "types", "design.ts"),
  ];

  let successCount = 0;

  files.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      if (sortDefaultDesignSettings(filePath)) {
        successCount++;
      }
    } else {
      logError(`File not found: ${filePath}`);
    }
  });

  log(`\n🎉 Completed! Sorted ${successCount}/${files.length} files.`);
}

if (require.main === module) {
  main();
}

module.exports = { sortDefaultDesignSettings, sortObjectKeys };

