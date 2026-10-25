import Image from "next/image";

/** A phone frame around a real screenshot of the Brix app (390×844 viewport captures). */
export function Phone({
  src,
  alt,
  sizes = "(max-width: 640px) 70vw, 320px",
  preload = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes?: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <figure className={`device-phone ${className}`}>
      <div className="device-phone__screen">
        <Image
          src={src}
          alt={alt}
          width={780}
          height={1688}
          sizes={sizes}
          preload={preload}
          loading={preload ? "eager" : "lazy"}
        />
        <span className="device-phone__island" aria-hidden="true" />
      </div>
    </figure>
  );
}

/** A plain browser window around a desktop screenshot. */
export function Browser({
  src,
  alt,
  url,
  sizes = "(max-width: 900px) 100vw, 720px",
  className = "",
}: {
  src: string;
  alt: string;
  url: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure className={`device-browser ${className}`}>
      <div className="device-browser__bar" aria-hidden="true">
        <span className="device-browser__lights">
          <i />
          <i />
          <i />
        </span>
        <span className="device-browser__url">{url}</span>
      </div>
      <Image src={src} alt={alt} width={1680} height={1050} sizes={sizes} />
    </figure>
  );
}
