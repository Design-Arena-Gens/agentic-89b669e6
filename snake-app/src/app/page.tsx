"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type Difficulty = "relaxed" | "classic" | "blitz";

const GRID_SIZE = 22;
const INITIAL_LENGTH = 4;
const SCORE_PER_FOOD = 10;
const STORAGE_KEY = "modern-snake-high-score-v1";
const SPEED_PRESETS: Record<Difficulty, number> = {
  relaxed: 170,
  classic: 130,
  blitz: 95,
};

const OPPOSITES: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const createInitialSnake = (): Point[] => {
  const startX = Math.floor(GRID_SIZE / 2) - Math.floor(INITIAL_LENGTH / 2);
  const y = Math.floor(GRID_SIZE / 2);

  return Array.from({ length: INITIAL_LENGTH }, (_, index) => ({
    x: startX + index,
    y,
  }));
};

const getNextHead = (head: Point, direction: Direction): Point => {
  switch (direction) {
    case "up":
      return { x: head.x, y: head.y - 1 };
    case "down":
      return { x: head.x, y: head.y + 1 };
    case "left":
      return { x: head.x - 1, y: head.y };
    case "right":
    default:
      return { x: head.x + 1, y: head.y };
  }
};

const createFood = (occupied: Point[]): Point => {
  const taken = new Set(occupied.map((segment) => `${segment.x}-${segment.y}`));
  const candidates: Point[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const key = `${x}-${y}`;
      if (!taken.has(key)) {
        candidates.push({ x, y });
      }
    }
  }

  if (!candidates.length) {
    return occupied[occupied.length - 1];
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
};

export default function Home() {
  const initialState = useMemo(() => {
    const snake = createInitialSnake();
    return {
      snake,
      food: createFood(snake),
    };
  }, []);

  const [snake, setSnake] = useState<Point[]>(initialState.snake);
  const [food, setFood] = useState<Point>(initialState.food);
  const foodRef = useRef<Point>(initialState.food);

  const [difficulty, setDifficulty] = useState<Difficulty>("classic");
  const [direction, setDirection] = useState<Direction>("right");
  const directionRef = useRef<Direction>("right");

  const [isRunning, setIsRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lastCollision, setLastCollision] = useState<"wall" | "self" | null>(
    null,
  );

  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  const [highScore, setHighScore] = useState(0);
  const highScoreRef = useRef(0);

  const [speed, setSpeed] = useState(SPEED_PRESETS[difficulty]);

  const minSpeed = useMemo(() => {
    const preset = SPEED_PRESETS[difficulty];
    return Math.max(Math.round(preset * 0.55), 55);
  }, [difficulty]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    foodRef.current = food;
  }, [food]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    highScoreRef.current = highScore;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(highScore));
    }
  }, [highScore]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return;
    }

    const parsed = Number.parseInt(storedValue, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    highScoreRef.current = parsed;
    startTransition(() => {
      setHighScore(parsed);
    });
  }, []);

  const resetGame = useCallback(
    (startAfterReset = false, overrideSpeed?: number) => {
      const freshSnake = createInitialSnake();
      const freshFood = createFood(freshSnake);

      setSnake(freshSnake);
      setFood(freshFood);
      foodRef.current = freshFood;

      directionRef.current = "right";
      setDirection("right");

      setScore(0);
      scoreRef.current = 0;

      setIsGameOver(false);
      setLastCollision(null);

      setSpeed(overrideSpeed ?? SPEED_PRESETS[difficulty]);
      setIsRunning(startAfterReset);
    },
    [difficulty],
  );

  const handleDirectionChange = useCallback((next: Direction) => {
    const current = directionRef.current;
    if (current === next || OPPOSITES[current] === next) {
      return;
    }

    directionRef.current = next;
    setDirection(next);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case "arrowup":
        case "w":
          event.preventDefault();
          handleDirectionChange("up");
          break;
        case "arrowdown":
        case "s":
          event.preventDefault();
          handleDirectionChange("down");
          break;
        case "arrowleft":
        case "a":
          event.preventDefault();
          handleDirectionChange("left");
          break;
        case "arrowright":
        case "d":
          event.preventDefault();
          handleDirectionChange("right");
          break;
        case " ":
          event.preventDefault();
          if (isGameOver) {
            resetGame(true);
          } else {
            setIsRunning((prev) => !prev);
          }
          break;
        case "enter":
          if (isGameOver) {
            event.preventDefault();
            resetGame(true);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDirectionChange, isGameOver, resetGame]);

  const tick = useCallback(() => {
    setSnake((previousSnake) => {
      const head = previousSnake[previousSnake.length - 1];
      const nextHead = getNextHead(head, directionRef.current);

      const hitsWall =
        nextHead.x < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= GRID_SIZE;

      const hitsSelf = previousSnake.some(
        (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
      );

      if (hitsWall || hitsSelf) {
        setIsRunning(false);
        setIsGameOver(true);
        setLastCollision(hitsWall ? "wall" : "self");

        if (scoreRef.current > highScoreRef.current) {
          highScoreRef.current = scoreRef.current;
          setHighScore(scoreRef.current);
        }

        return previousSnake;
      }

      const newSnake = [...previousSnake, nextHead];
      const ateFood =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;

      if (!ateFood) {
        newSnake.shift();
        return newSnake;
      }

      const nextScore = scoreRef.current + SCORE_PER_FOOD;
      scoreRef.current = nextScore;
      setScore(nextScore);

      if (nextScore > highScoreRef.current) {
        highScoreRef.current = nextScore;
        setHighScore(nextScore);
      }

      const nextFood = createFood(newSnake);
      foodRef.current = nextFood;
      setFood(nextFood);

      setSpeed((currentSpeed) => Math.max(currentSpeed * 0.94, minSpeed));

      return newSnake;
    });
  }, [minSpeed]);

  useEffect(() => {
    if (!isRunning || isGameOver) {
      return;
    }

    const interval = window.setInterval(() => {
      tick();
    }, speed);

    return () => window.clearInterval(interval);
  }, [isRunning, isGameOver, speed, tick]);

  const handlePrimaryAction = useCallback(() => {
    if (isGameOver) {
      resetGame(true);
      return;
    }

    setIsRunning((prev) => !prev);
  }, [isGameOver, resetGame]);

  const handleReset = useCallback(() => {
    resetGame(false);
  }, [resetGame]);

  const handleDifficultyChangeClick = useCallback(
    (nextDifficulty: Difficulty) => {
      if (nextDifficulty === difficulty) {
        return;
      }

      setDifficulty(nextDifficulty);
      resetGame(false, SPEED_PRESETS[nextDifficulty]);
    },
    [difficulty, resetGame],
  );

  const boardCells = useMemo(() => {
    const snakeMap = new Map<string, number>();
    snake.forEach((segment, index) => {
      snakeMap.set(`${segment.x}-${segment.y}`, index);
    });

    return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, cellIndex) => {
      const x = cellIndex % GRID_SIZE;
      const y = Math.floor(cellIndex / GRID_SIZE);
      const key = `${x}-${y}`;

      const segmentIndex = snakeMap.get(key);
      const isSnake = typeof segmentIndex === "number";
      const isHead = segmentIndex === snake.length - 1;
      const isFood = food.x === x && food.y === y;

      const intensity =
        isSnake && snake.length > 1
          ? 0.35 + (segmentIndex! / Math.max(snake.length - 1, 1)) * 0.55
          : 0.85;

      return {
        key,
        isSnake,
        isHead,
        isFood,
        intensity,
      };
    });
  }, [food, snake]);

  const difficultyLabel: Record<Difficulty, string> = {
    relaxed: "Relaxed",
    classic: "Classic",
    blitz: "Blitz",
  };

  const statusLabel = isGameOver
    ? "Game Over"
    : isRunning
      ? "In Motion"
      : "Ready";

  const collisionMessage =
    lastCollision === "wall"
      ? "You hit the arena wall!"
      : lastCollision === "self"
        ? "You ran into yourself!"
        : null;

  const primaryActionLabel = isGameOver
    ? "Play Again"
    : isRunning
      ? "Pause"
      : "Start";

  return (
    <div className="min-h-screen px-4 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-6 text-center sm:text-left">
          <div className="inline-flex w-full flex-wrap items-center justify-center gap-3 sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">
                Modern Arcade
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                Neon Snake
              </h1>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-zinc-900/5 px-4 py-1 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-black/5 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
              <span>{statusLabel}</span>
            </div>
          </div>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Glide through a responsive grid, chain together combos, and chase
            high scores in this polished take on the classic snake game.
            Keyboard arrows or WASD keep the snake in motion—space toggles
            pause, and Enter restarts when the run is over.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr),minmax(260px,1fr)]">
          <section className="relative flex flex-col items-center gap-6">
            <div className="relative w-full max-w-[560px]">
              <div className="absolute inset-0 -z-10 rounded-[32px] bg-gradient-to-br from-cyan-500/30 via-transparent to-emerald-500/20 blur-2xl" />
              <div className="relative rounded-[28px] border border-white/10 bg-white/60 p-3 shadow-xl backdrop-blur-xl dark:bg-zinc-900/70">
                <div
                  className="grid aspect-square w-full gap-[4px] rounded-[22px] bg-zinc-900/5 p-3 dark:bg-white/5"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                  }}
                >
                  {boardCells.map(({ key, isSnake, isHead, isFood, intensity }) => (
                    <div
                      key={key}
                      className="relative flex items-center justify-center overflow-hidden rounded-[10px] bg-white/20 shadow-inner backdrop-blur-sm transition-transform duration-200 dark:bg-zinc-800/40"
                    >
                      {isSnake && (
                        <div
                          className={`absolute inset-1 rounded-[9px] ${
                            isHead
                              ? "bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 shadow-[0_12px_24px_rgba(16,185,129,0.35)]"
                              : "bg-emerald-400/90"
                          }`}
                          style={{
                            opacity: isHead ? 1 : intensity,
                          }}
                        />
                      )}
                      {isFood && (
                        <div className="absolute inset-[30%] rounded-full bg-gradient-to-br from-rose-400 via-orange-400 to-amber-400 shadow-[0_0_16px_rgba(248,113,113,0.5)] ring-2 ring-white/70 dark:ring-white/30" />
                      )}
                    </div>
                  ))}
                </div>

                {isGameOver && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[28px] bg-zinc-950/70 text-center text-white backdrop-blur-md">
                    <h2 className="text-3xl font-semibold tracking-tight">
                      Game Over
                    </h2>
                    {collisionMessage && (
                      <p className="text-sm text-zinc-200">{collisionMessage}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => resetGame(true)}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:translate-y-[1px] hover:bg-zinc-200"
                    >
                      Restart
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 via-green-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                {primaryActionLabel}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-full border border-emerald-300/60 px-6 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 dark:border-emerald-400/50 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
              >
                Reset
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/70 p-6 shadow-xl backdrop-blur-lg dark:bg-zinc-900/70">
              <div className="grid gap-4 text-sm">
                <div className="flex items-start justify-between gap-4 rounded-2xl bg-zinc-900/5 px-4 py-3 text-left dark:bg-white/5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                      Score
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {score}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                      Best
                    </p>
                    <p className="mt-1 text-xl font-semibold text-emerald-500">
                      {highScore}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-900/5 px-4 py-3 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Difficulty
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(Object.keys(SPEED_PRESETS) as Difficulty[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleDifficultyChangeClick(item)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          difficulty === item
                            ? "bg-gradient-to-r from-emerald-500 via-green-500 to-cyan-500 text-white shadow shadow-emerald-400/40 focus-visible:outline-emerald-300"
                            : "bg-white/80 text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-white focus-visible:outline-zinc-400 dark:bg-zinc-900/80 dark:text-zinc-300 dark:ring-zinc-700/70 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {difficultyLabel[item]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-900/5 px-4 py-4 leading-relaxed text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Controls
                  </p>
                  <ul className="space-y-1 text-sm">
                    <li>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Move:
                      </span>{" "}
                      Arrow Keys / WASD
                    </li>
                    <li>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Pause:
                      </span>{" "}
                      Space
                    </li>
                    <li>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Restart:
                      </span>{" "}
                      Enter
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 via-green-400/25 to-cyan-400/25 px-4 py-4 text-sm text-emerald-700 shadow-lg shadow-emerald-500/10 dark:text-emerald-200">
                  <p className="text-xs uppercase tracking-[0.25em]">
                    Pro Tip
                  </p>
                  <p className="mt-2 leading-relaxed">
                    Keep your movements smooth and paint clean loops to avoid
                    boxing yourself in. The longer you survive, the faster the
                    snake glides.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
