import VerifyEmailClient from './VerifyEmailClient'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

type VerifyEmailPageProps = {
  // Next 15 App Router types `searchParams` as a Promise in generated PageProps.
  // `await` is safe even if the runtime value is a plain object.
  searchParams?: Promise<SearchParams>
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const sp = (await searchParams) ?? {}
  const raw = sp.email
  const email = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')

  return <VerifyEmailClient email={email} />
}
