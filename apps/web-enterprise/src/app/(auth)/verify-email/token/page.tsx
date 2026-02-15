import VerifyEmailTokenClient from "./VerifyEmailTokenClient";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type VerifyEmailTokenPageProps = {
  searchParams?: SearchParams;
};

export default function VerifyEmailTokenPage({ searchParams = {} }: VerifyEmailTokenPageProps) {
  const rawToken = searchParams.token;
  const token = Array.isArray(rawToken) ? (rawToken[0] ?? "") : (rawToken ?? "");

  const rawEmail = searchParams.email;
  const email = Array.isArray(rawEmail) ? (rawEmail[0] ?? "") : (rawEmail ?? "");

  return <VerifyEmailTokenClient token={token} email={email} />;
}
