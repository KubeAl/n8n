import type { IExecuteFunctions } from 'n8n-core';
import type { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions, wrapData } from '../../../../../utils/utilities';
import { theHiveApiRequest } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName: 'Case ID',
		name: 'id',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the case',
	},
	{
		displayName: 'Attachment Name or ID',
		name: 'attachmentId',
		type: 'options',
		default: '',
		required: true,
		description:
			'ID of the attachment. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		typeOptions: {
			loadOptionsMethod: 'getCaseAttachments',
		},
	},
];

const displayOptions = {
	show: {
		resource: ['case'],
		operation: ['getAttachment'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	let responseData: IDataObject | IDataObject[] = [];
	const caseId = this.getNodeParameter('id', i) as string;
	const attachmentId = this.getNodeParameter('attachmentId', i) as string;

	responseData = await theHiveApiRequest.call(
		this,
		'GET',
		`/v1/case/${caseId}/attachment/${attachmentId}`,
	);

	const executionData = this.helpers.constructExecutionMetaData(wrapData({ data: responseData }), {
		itemData: { item: i },
	});

	return executionData;
}
