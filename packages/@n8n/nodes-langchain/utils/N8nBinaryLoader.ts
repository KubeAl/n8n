import type {
	IExecuteFunctions,
	INodeExecutionData,
	IBinaryData,
} from 'n8n-workflow';
import { NodeOperationError, BINARY_ENCODING } from 'n8n-workflow';

import type { TextSplitter } from 'langchain/text_splitter';
import type { Document } from 'langchain/document';
import { CSVLoader } from 'langchain/document_loaders/fs/csv';
import { DocxLoader } from 'langchain/document_loaders/fs/docx';
import { JSONLoader } from 'langchain/document_loaders/fs/json';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { getAndValidateSupplyInput } from './getAndValidateSupplyInput';
import { N8nEPubLoader } from './EpubLoader';

const SUPPORTED_MIME_TYPES = {
	pdfLoader: ['application/pdf'],
	csvLoader: ['text/csv'],
	epubLoader: ['application/epub+zip'],
	docxLoader: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
	textLoader: ['text/plain'],
	jsonLoader: ['application/json'],
};

export class N8nBinaryLoader {
	private context: IExecuteFunctions;

	constructor(context: IExecuteFunctions) {
		this.context = context;
	}

	async process(items?: INodeExecutionData[]): Promise<Document[]> {
		const selectedLoader: keyof typeof SUPPORTED_MIME_TYPES = this.context.getNodeParameter(
			'loader',
			0,
		) as keyof typeof SUPPORTED_MIME_TYPES;
		const binaryDataKey = this.context.getNodeParameter('binaryDataKey', 0) as string;
		const docs: Document[] = [];

		if (!items) return docs;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			// TODO: Should we support traversing the object to find the binary data?
			const binaryData = items[itemIndex].binary?.[binaryDataKey] as IBinaryData;

			if (!binaryData) {
				throw new NodeOperationError(this.context.getNode(), 'No binary data set.');
			}

			const { data, mimeType } = binaryData;

			if (!Object.values(SUPPORTED_MIME_TYPES).flat().includes(mimeType)) {
				throw new NodeOperationError(this.context.getNode(), `Unsupported mime type: ${mimeType}`);
			}
			if (
				!SUPPORTED_MIME_TYPES[selectedLoader].includes(mimeType) &&
				selectedLoader !== 'textLoader'
			) {
				throw new NodeOperationError(
					this.context.getNode(),
					`Unsupported mime type: ${mimeType} for selected loader: ${selectedLoader}`,
				);
			}

			const bufferData = Buffer.from(data, BINARY_ENCODING).buffer;
			const itemBlob = new Blob([new Uint8Array(bufferData)], { type: mimeType });

			let loader: PDFLoader | CSVLoader | N8nEPubLoader | DocxLoader | TextLoader | JSONLoader;
			switch (mimeType) {
				case 'application/pdf':
					const splitPages = this.context.getNodeParameter('splitPages', 0) as boolean;
					loader = new PDFLoader(itemBlob, {
						splitPages,
					});
					break;
				case 'text/csv':
					const column = this.context.getNodeParameter('column', 0) as string;
					const separator = this.context.getNodeParameter('separator', 0) as string;

					loader = new CSVLoader(itemBlob, {
						column,
						separator,
					});
					break;
				case 'application/epub+zip':
					loader = new N8nEPubLoader(Buffer.from(bufferData));
					break;
				case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
					loader = new DocxLoader(itemBlob);
					break;
				case 'text/plain':
					loader = new TextLoader(itemBlob);
					break;
				case 'application/json':
					const pointers = this.context.getNodeParameter('pointers', 0) as string;
					const pointersArray = pointers.split(',').map((pointer) => pointer.trim());
					loader = new JSONLoader(itemBlob, pointersArray);
					break;
				default:
					throw new NodeOperationError(
						this.context.getNode(),
						`Unsupported mime type: ${mimeType}`,
					);
			}

			const textSplitter = (await getAndValidateSupplyInput(this.context, 'textSplitter')) as
				| TextSplitter
				| undefined;
			const loadedDoc = textSplitter
				? await loader.loadAndSplit(textSplitter)
				: await loader.load();

			docs.push(...loadedDoc);
		}
		return docs;
	}
}