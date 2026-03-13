interface Props {
  isRunning: boolean;
  onToggle: () => void;
}

/**
 * Start/Stop button and basic controls.
 */
export function Controls({ isRunning, onToggle }: Props) {
  return (
    <div className="controls">
      <button
        className={`btn-toggle ${isRunning ? 'active' : ''}`}
        onClick={onToggle}
      >
        {isRunning ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}
