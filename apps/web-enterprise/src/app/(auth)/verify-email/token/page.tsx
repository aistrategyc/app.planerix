import VerifyEmailTokenClient from "./VerifyEmailTokenClient";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type VerifyEmailTokenPageProps = {
  // Next 15 App Router types `searchParams` as a Promise in generated PageProps.
  // `await` is safe even if the runtime value is a plain object.
  searchParams?: Promise<SearchParams>;
};

export default async function VerifyEmailTokenPage({ searchParams }: VerifyEmailTokenPageProps) {
  const sp = (await searchParams) ?? {};
  const rawToken = sp.token;
  const token = Array.isArray(rawToken) ? (rawToken[0] ?? "") : (rawToken ?? "");

  const rawEmail = sp.email;
  const email = Array.isArray(rawEmail) ? (rawEmail[0] ?? "") : (rawEmail ?? "");

  return <VerifyEmailTokenClient token={token} email={email} />;
}
