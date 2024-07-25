import {
  ACTIONS_CORS_HEADERS,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  createPostResponse,
} from "@solana/actions";
import {
  Authorized,
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  Lockup,
  PublicKey,
  StakeProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import queryString from "query-string";

const DEFAULT_SOL_TO_STAKE = 1;

export const GET = (req: Request) => {
  const payload: ActionGetResponse = {
    icon: new URL(
      "/greed_blink_participate.png",
      new URL(req.url).origin,
    ).toString(),
    label: "Stake with a lockup",
    description:
      "Lock and stake SOL until Breakpoint (September 20th) to participate in the Academy and earn rewards!",
    title: "GREED Academy",
    links: {
      actions: [
        {
          label: "1 SOL",
          href: "/blink/lock?amount=1",
        },
        {
          label: "5 SOL",
          href: "/blink/lock?amount=5",
        },
        {
          label: "10 SOL",
          href: "/blink/lock?amount=10",
        },
        {
          label: "Stake with a lockup",
          href: "/blink/lock?amount={amount}",
          parameters: [
            {
              name: "amount",
              label: "Enter a custom SOL amount",
            },
          ],
        },
      ],
    },
  };

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
};

export const OPTIONS = GET;

const CUSTODIAN = new PublicKey("DYSfcQYyioaQL3uLQk2xvjaHB4zx6DyGEDhywd3mfh8s");
export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest = await req.json();
    const { query } = queryString.parseUrl(req.url, { parseNumbers: true });

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (error) {
      return Response.json(
        { message: "Invalid account provided" },
        {
          status: 400,
          headers: ACTIONS_CORS_HEADERS,
        },
      );
    }

    if (typeof query?.amount === "number" && query.amount < 1) {
      return Response.json(
        { message: "Invalid amount (less than 1)" },
        {
          status: 400,
          statusText: "Bad Request",
          headers: ACTIONS_CORS_HEADERS,
        },
      );
    }

    const transaction = new Transaction();
    const lockupTime = 1726815600; // full lockup
    const lockup = new Lockup(lockupTime, 0, CUSTODIAN);

    const stakeAccount = await PublicKey.createWithSeed(
      account,
      "deposit",
      StakeProgram.programId,
    );

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      }),
      StakeProgram.createAccountWithSeed({
        fromPubkey: account,
        authorized: new Authorized(account, account), // Here we set two authorities: Stake Authority and Withdrawal Authority
        lockup,
        basePubkey: account,
        seed: "deposit",
        stakePubkey: stakeAccount,
        lamports:
          (query?.amount && typeof query.amount === "number"
            ? query.amount
            : DEFAULT_SOL_TO_STAKE) * LAMPORTS_PER_SOL,
      }),
      StakeProgram.delegate({
        stakePubkey: stakeAccount,
        authorizedPubkey: account,
        votePubkey: new PublicKey(
          "GREEDkpTvpKzcGvBu9qd36yk6BfjTWPShB67gLWuixMv",
        ),
      }),
    );

    transaction.feePayer = account;

    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("mainnet-beta"),
    );
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
      },
    });

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    return Response.json("An error occurred", {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};
