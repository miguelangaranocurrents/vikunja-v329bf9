import {Extension} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import type {Fragment, Node as PMNode, Slice} from '@tiptap/pm/model'

function leafText(node: PMNode): string {
	if (node.type.name === 'hardBreak') {
		return '\n'
	}
	const fromSpec = node.type.spec.leafText
	if (fromSpec) {
		return fromSpec(node)
	}
	return ''
}

function inlineText(node: PMNode): string {
	return node.textBetween(0, node.content.size, '\n', leafText)
}

function indent(text: string, prefix: string): string {
	const pad = ' '.repeat(prefix.length)
	return text
		.split('\n')
		.map((line, i) => (i === 0 ? prefix : (line === '' ? '' : pad)) + line)
		.join('\n')
}

function serializeBlocks(fragment: Fragment, listType: string | null = null, start = 1): string {
	if (fragment.firstChild?.isInline) {
		return fragment.textBetween(0, fragment.size, '\n', leafText)
	}

	const lines: string[] = []
	let index = 0
	fragment.forEach(node => {
		lines.push(serializeNode(node, listType, start + index))
		index++
	})
	return lines.filter(line => line !== '').join('\n')
}

function serializeNode(node: PMNode, listType: string | null, number: number): string {
	const name = node.type.name

	if (node.isText) {
		return node.text ?? ''
	}

	if (node.isLeaf) {
		return leafText(node)
	}

	if (node.isTextblock) {
		return inlineText(node)
	}

	if (name === 'bulletList' || name === 'taskList') {
		return serializeBlocks(node.content, name)
	}

	if (name === 'orderedList') {
		return serializeBlocks(node.content, name, Number(node.attrs.start ?? 1))
	}

	if (name === 'listItem' || name === 'taskItem') {
		const content = serializeBlocks(node.content)
		let prefix = '- '
		if (name === 'taskItem') {
			prefix = node.attrs.checked ? '- [x] ' : '- [ ] '
		} else if (listType === 'orderedList') {
			prefix = `${number}. `
		}
		return indent(content, prefix)
	}

	return serializeBlocks(node.content)
}

export function serializeSliceAsText(slice: Slice): string {
	return serializeBlocks(slice.content)
}

/**
 * Keeps the structure of lists (bullet markers, numbering, checkboxes) when copying
 * editor content as plain text, instead of flattening everything into bare lines.
 */
export const ClipboardTextSerializer = Extension.create({
	name: 'listAwareClipboardTextSerializer',
	priority: 1000,

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('listAwareClipboardTextSerializer'),
				props: {
					clipboardTextSerializer: slice => serializeSliceAsText(slice),
				},
			}),
		]
	},
})
