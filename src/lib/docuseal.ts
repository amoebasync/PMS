/**
 * DocuSeal Cloud API クライアント
 * https://www.docuseal.com/docs/api
 */

const DOCUSEAL_API_BASE = 'https://api.docuseal.com';

function getApiKey(): string {
  const key = process.env.DOCUSEAL_API_KEY;
  if (!key) throw new Error('DOCUSEAL_API_KEY is not set');
  return key;
}

function getTemplateId(): number {
  const id = process.env.DOCUSEAL_TEMPLATE_ID;
  if (!id) throw new Error('DOCUSEAL_TEMPLATE_ID is not set');
  return parseInt(id, 10);
}

export function isDocusealConfigured(): boolean {
  return !!(process.env.DOCUSEAL_API_KEY && process.env.DOCUSEAL_TEMPLATE_ID);
}

interface CreateSubmissionParams {
  email: string;
  name: string;
  externalId: string; // distributor ID
  sendEmail?: boolean;
}

interface DocusealSubmission {
  id: number;
  slug: string;
  status: string;
  submitters: DocusealSubmitter[];
}

interface DocusealSubmitter {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  slug: string;
  external_id: string | null;
  completed_at: string | null;
  documents: { name: string; url: string }[];
  url: string; // 署名用URL
}

/**
 * 配布員に業務委託契約書を送信する
 */
export async function createContractSubmission(params: CreateSubmissionParams): Promise<DocusealSubmission> {
  const res = await fetch(`${DOCUSEAL_API_BASE}/submissions`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: getTemplateId(),
      send_email: params.sendEmail ?? true,
      submitters: [
        {
          role: 'Contractor',
          email: params.email,
          name: params.name,
          external_id: params.externalId,
          fields: [
            { name: 'Contractor Name', default_value: params.name, readonly: false },
            { name: 'Agreement Date', default_value: new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Tokyo' }), readonly: false },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DocuSeal API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * submission の詳細を取得
 */
export async function getSubmission(submissionId: number): Promise<DocusealSubmission> {
  const res = await fetch(`${DOCUSEAL_API_BASE}/submissions/${submissionId}`, {
    headers: { 'X-Auth-Token': getApiKey() },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DocuSeal API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * submitter の詳細を取得（署名URL含む）
 */
export async function getSubmitter(submitterId: number): Promise<DocusealSubmitter> {
  const res = await fetch(`${DOCUSEAL_API_BASE}/submitters/${submitterId}`, {
    headers: { 'X-Auth-Token': getApiKey() },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DocuSeal API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * 署名済みPDFをダウンロードしてBufferで返す
 */
export async function downloadSignedPdf(documentUrl: string): Promise<Buffer> {
  const res = await fetch(documentUrl);
  if (!res.ok) {
    throw new Error(`Failed to download PDF (${res.status})`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}
