'use client';

import { useConnect } from 'wagmi';

export default function ConnectButton() {
  const { connect, connectors } = useConnect();

  return (
    <div className="flex flex-col gap-3">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Connect with {connector.name}
        </button>
      ))}
    </div>
  );
}
