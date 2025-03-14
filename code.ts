export interface ReadableParams {
	doc: Document;
	hostname: string;
	resultDir: string;
}

export const extractReadable = (params: ReadableParams) => {
	const { doc, hostname, resultDir } = params;
	const title = doc.title.replace(/[/\\?%*:|"<>]/g, '');
	const images: string[] = [];
	const article = doc.querySelector('article');

	article?.querySelectorAll('img').forEach(img => {
		const src = img.getAttribute('src');
		if (src && !src.startsWith('http')) {
			images.push(src);

			const p = doc.createElement('p');
			p.innerHTML = `!$[[${resultDir}/${title}/images/${src}]]$`

			img.parentNode?.insertBefore(p, img);
			img.remove();
		}
	})

	if (hostname === 'craftinginterpreters.com') {
		// code block
		article?.querySelectorAll('.codehilite pre').forEach(pre => {
			const codeElement = doc.createElement('code');
			const lines = pre.innerHTML.split('\n');
			let minIndent = 10000;
			lines.forEach((line, i) => {
				if (i === 0) return;

				let count = 0
				while (line[count] === ' ') {
					count++;
				}

				if (count < minIndent) {
					minIndent = count;
				}
			})
			const trimmed =
				minIndent === 10000
					? lines.join('\n')
					: lines.map((line, i) => i === 0 ? line : line.slice(minIndent)).join('\n');
			codeElement.innerHTML = trimmed;
			pre.innerHTML = '';
			pre.appendChild(codeElement);
		})

		// remove footer
		article?.querySelectorAll('footer').forEach(footer => { footer.remove() })

		// add space after <small>
		article?.querySelectorAll('a small').forEach(small => {
			const html = small.innerHTML;
			small.innerHTML = html + ' ';
		})
	}

	return {
		readable: article?.innerHTML,
		title: doc.title,
		images,
	}
}
