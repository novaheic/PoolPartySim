import { useCallback, useEffect, useState } from 'react';
import { ActivityFeed } from './components/ActivityFeed';
import { ArbitrageHint } from './components/ArbitrageHint';
import { Challenges } from './components/Challenges';
import { CurveChart } from './components/CurveChart';
import { InstructorMode } from './components/InstructorMode';
import { JoinLobby } from './components/JoinLobby';
import { LiquidityPanel } from './components/LiquidityPanel';
import { MyPosition } from './components/MyPosition';
import { PoolCards } from './components/PoolCards';
import { SwapPanel } from './components/SwapPanel';
import { Presence, TopBar } from './components/TopBar';
import { Tabs } from './components/ui';
import { useHasJoined, useStore } from './store';
import type { TokenId } from './types';

export default function App() {
  const connect = useStore((s) => s.connect);
  const hasJoined = useHasJoined();
  const [sideTab, setSideTab] = useState('swap');
  const [previewTokenIn, setPreviewTokenIn] = useState<TokenId>('WOOD');
  const [previewAmount, setPreviewAmount] = useState(10);

  const onSwapPreview = useCallback((tokenIn: TokenId, amountIn: number) => {
    setPreviewTokenIn(tokenIn);
    setPreviewAmount(amountIn);
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  if (!hasJoined) {
    return <JoinLobby />;
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 md:p-6">
      <TopBar />
      <Presence />
      <InstructorMode />

      {/* DOM order is the mobile order; on desktop the sidebar spans all rows
          and any extra height goes to the activity row. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_1fr] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="lg:col-start-1 lg:row-start-1">
          <PoolCards />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <CurveChart
            tokenIn={previewTokenIn}
            amountIn={sideTab === 'swap' ? previewAmount : 0}
          />
        </div>

        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <div className="card space-y-4 p-5">
            <Tabs
              tabs={[
                { id: 'swap', label: 'Swap' },
                { id: 'liquidity', label: 'Liquidity' },
              ]}
              value={sideTab}
              onChange={setSideTab}
            />
            {sideTab === 'swap' ? (
              <SwapPanel onPreviewChange={onSwapPreview} />
            ) : (
              <LiquidityPanel />
            )}
          </div>
          <MyPosition />
          <ArbitrageHint />
          <Challenges />
        </aside>

        <div className="flex min-h-0 flex-col lg:col-start-1 lg:row-start-3 [&>*]:flex-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
