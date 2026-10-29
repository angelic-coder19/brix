import BrixBuddy from "../brix/BrixBuddy";
import "./loader.css";

/** Brix bouncing over a pulsing shadow while something loads. */
export function BrixLoader({ label }: { label: string }) {
  return (
    <div className="brix-loader" role="status">
      <div className="brix-loader__stage" aria-hidden="true">
        <BrixBuddy scale={0.34} mood="thinking" follow={false} decorative />
        <span className="brix-loader__shadow" />
      </div>
      <p className="brix-loader__label">
        {label}
        <span className="brix-loader__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
    </div>
  );
}
