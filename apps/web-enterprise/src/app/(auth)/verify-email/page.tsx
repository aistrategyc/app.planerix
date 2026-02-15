import VerifyEmailClient from './VerifyEmailClient'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

type VerifyEmailPageProps = {
  searchParams?: SearchParams
}

export default function VerifyEmailPage({ searchParams = {} }: VerifyEmailPageProps) {
  const raw = searchParams.email
  const email = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')

  return <VerifyEmailClient email={email} />
}
