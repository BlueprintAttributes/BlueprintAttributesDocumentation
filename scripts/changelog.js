import arg from 'arg';
import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import path from 'path';
import got from 'gh-got';
import goat from 'got';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit'
import remarkGfm from 'remark-gfm';
import remarkGithub from 'remark-github';
import { format } from 'date-fns';
import { mkdirp } from 'mkdirp';
import semver from 'semver';

const token = process.env.GITHUB_TOKEN;
const user = `BlueprintAttributes`;
const repo = `BlueprintAttributes`;
const assetsPattern = `https://github.com/${user}/${repo}/assets/`;

if (!token) {
  console.error(`No token could be found in process.env`);
  process.exit(1);
}

const args = arg({
  // Types
  '--help': Boolean,
  '--version': Boolean,
  '--output': (value, argName, previousValue) => {
    return path.resolve(value);
  },
  '--tag': String,

  // Aliases
  '-v': '--version',
  '--out': '--output',
  '-o': '--output',
  '-t': '--tag'
});

console.log('arg', args);

const output = args['--output'] || path.resolve('pages/docs/changelog.md');
const sinceTag = args['--tag'];

console.log(`Using token "${token}" to fetch release note`);
console.log(`Using output "${output}" to generate release note`);
console.log(`---`);

// List of heading text we know and always want to have at a fixed 5 lvl heading
const fixedHeadings = [
  `Breaking Changes 🛠`,
  `New Features 🎉`,
  `Bug Fixes`,
  `Other Changes`
];

// List of Pull Request found in the release notes, to fetch and generate just after markdown parsing
// List is filled during markdown parsing

const remarkRemoveMentions = () => {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      // Text
      if (node.type === 'text') {
        // Remove any " by @mklabs" tokens
        node.value = node.value.replace(/ by @mklabs/g, '');
        return;
      }
    });
  };
};

const remarkTransformPullRequest = () => {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      // Links
      // Gather the list of Pull Requests links, and replace with local URLs to generated .md
      if (node.type === 'link') {
        // const reg = new RegExp(`https://github.com/${user}/${repo}/(pull|issues)/(\\d+)$`);
        const reg = new RegExp(`https://github.com/${user}/${repo}/(pull)/(\\d+)$`);
        const match = node.url.match(reg);

        if (match) {
          console.log('MAAAAAAAAAAATCH')
          node.url = `/docs/changelog/pull/${match[2]}`;
          if (node.children && node.children[0]) {
            node.children[0].value = `#${match[2]}`;
          }

          return;
        }
        else {

        }
      }
    });
  };
};

const remarkRewritePullRequestImageAssetsUrl = (imagesToDownload) => {
  return () => {
    return (tree) => {
      visit(tree, (node, index, parent) => {
        if (node.type === 'image') {
          const { url } = node;

          if (url.startsWith(assetsPattern)) {
            imagesToDownload.push(url);
            node.url = `./${url.replace(assetsPattern, '').replace('/', '-')}.png`;
          }

          return;
        }
      });
    };
  };
};


const remarkTransformReleaseNote = (pullRequestLinks) => {
  return () => {
    return (tree) => {
      visit(tree, (node, index, parent) => {
        // Headings
        if (node.type === 'heading') {
          const { children } = node;

          // Remove first "What's Changed" heading
          if (children && children.find(child => child.value === `What's Changed`)) {
            parent.children.splice(index, 1);
            return index;
          }

          // Increase any known heading to a fixed 5 level heading depth
          const isFixedHeading = !!children.find(child => fixedHeadings.includes(child.value));
          if (isFixedHeading) {
            node.depth = 5;
            return;
          }

          return;
        }

        // Links
        // Gather the list of Pull Requests links, and replace with local URLs to generated .md
        if (node.type === 'link') {
          const reg = new RegExp(`https://github.com/${user}/${repo}/(pull|issues)/(\\d+)$`);
          const match = node.url.match(reg);

          if (match) {
            pullRequestLinks.push({
              url: match[0],
              api: `repos/${user}/${repo}/pulls/${match[2]}`
            });

            node.url = `changelog/pull/${match[2]}`;
            if (node.children && node.children[0]) {
              node.children[0].value = `#${match[2]}`;
            }

            return;
          }
        }
      });
    };
  };
};

const fetchPullRequest = async ({ url, api }) => {
  return await got(api);
};

const fetchImage = (image, dirname) => {
  return new Promise((resolve, reject) => {
    const filename = image
      .replace(assetsPattern, '')
      .replace('/', '-');

    const downloadStream = goat.stream(image, {
      headers: {
        'authorization': `token ${token}`
      }
    });

    downloadStream.on('error', reject);

    const destination = path.join(dirname, filename + '.png');
    const fileWriterStream = createWriteStream(destination)
      .on('error', reject)
      .on('finish', resolve);

    console.log(`Download image ${image} to ${destination}`);
    downloadStream.pipe(fileWriterStream);
  });
};

const getReleaseNoteContent = async (tag) => {
  const { body } = await got(`repos/${user}/${repo}/releases/tags/${tag}`);

  let pullRequestLinks = [];

  // Parse and transform markdown of release note

  const content = await unified()
    .use(remarkParse)
    .use(remarkRemoveMentions)
    .use(remarkGfm)
    .use(remarkGithub, {
      repository: `${user}/${repo}`
    })
    .use(remarkTransformReleaseNote(pullRequestLinks))
    .use(remarkStringify)

    // .use(remarkRehype)
    // .use(rehypeSanitize)
    // .use(rehypeStringify)
    .process(body.body)

  return {
    content: String(content),
    pullRequestLinks
  };
};

const getPullRequestContent = async (tag, result) => {
  const { number, created_at, html_url, body } = result.body;
  let { title } = result.body;

  // escape title for " characters before wrapping it in "" in frontmatter
  title = title.replace(/"/g, '\\"');

  let imagesToDownload = [];

  // transform markdown content
  const content = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkGithub, {
      repository: `${user}/${repo}`
    })
    .use(remarkTransformPullRequest)
    .use(remarkRewritePullRequestImageAssetsUrl(imagesToDownload))
    .use(remarkStringify)
    .process(body || '');

  const promises = imagesToDownload.map(image => fetchImage(image, path.join(path.dirname(output), `changelog/pull/${number}`)));
  Promise.all(promises).catch(console.error);

  return `---
title: "Pull Request #${number}"
description: "${title}"
---

*[on ${format(new Date(created_at), 'PPP')}](${html_url})*

## ${title}

${content}
`;
};

const generateForTag = async (tag, tags = []) => {
  const url = `repos/${user}/${repo}/releases/tags/${tag}`;

  console.log(`Generating release notes PRs for ${tag}`);
  console.log(`Fetching url: ${url}`);
  const { body } = await got(url);

  // Parse and transform markdown of release note

  const { content, pullRequestLinks } = await getReleaseNoteContent(tag);

  // Fetch and build each Pull Request page

  for (const link of pullRequestLinks) {
    const result = await fetchPullRequest(link);
    const { number } = result.body;
    const dirname = path.join(path.dirname(output), `changelog/pull/${number}`);
    await mkdirp(dirname);
    console.log(`Created directory ${dirname}`);

    const content = await getPullRequestContent(tag, result);

    const filename = path.join(dirname, 'index.md');
    await fs.writeFile(filename, content);

    console.log(`Created file at ${filename}`);
  }

  const date = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(body.created_at));
  let releaseNoteContent = `## [${body.name}](https://github.com/${user}/${repo}/releases/tag/${tag}) - ${date}

${content}
`;

  // Remove <!-- Release notes generated using configuration in .github/release.yml at main --> from output if any
  // Can cause rendering errors on mdx document
  releaseNoteContent = releaseNoteContent.replace('<!-- Release notes generated using configuration in .github/release.yml at main -->', '');

  // Remove any heading, nextra causing issue with TOC and headings above a certain lvl I don't want to be in the TOC
  // releaseNoteContent = releaseNoteContent.replace(`## What's Changed`, `**What's Changed**`);
  releaseNoteContent = releaseNoteContent.replace(/#.+ Other Changes/g, `**Other Changes**`);
  releaseNoteContent = releaseNoteContent.replace(/#.+ Bug Fixes/g, `**Bug Fixes**`);

  return releaseNoteContent;
}

const fetchAllReleases = async () => {
  const { body } = await got(`repos/${user}/${repo}/releases`);
  return body;
};

const fetchAllTags = async () => {
  const releases = await fetchAllReleases();
  let tags = releases.map(release => release.tag_name);

  if (sinceTag) {
    tags = tags.filter(tag => semver.gt(tag, sinceTag));
  }

  return tags;
};


const main = async () => {

  let tags = await fetchAllTags();

  let contents = `---
description: Changelog
---

`;

  for (const tag of tags) {
    const content = await generateForTag(tag, tags);
    contents += `
${content}
  `;
  }

  const now = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  contents += `
---

Updated ${now}
`;

  await fs.writeFile(output, contents)
};

main();