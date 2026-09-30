/** The Pinocchio mascot (public/icon.svg): same art as the app icon and the link preview. */
const SRC = `${import.meta.env.BASE_URL}icon.svg`;

export function PinocchioIcon({ size = 40, class: className = '' }: { size?: number | string; class?: string }) {
  return <img src={SRC} alt="" aria-hidden="true" draggable={false} class={`pinocchio-icon ${className}`} style={{ width: size, height: size }} />;
}

/** Icons in the strings file are emoji, or 'mascot' for the Pinocchio icon. */
export function Icon({ icon, size }: { icon: string; size?: number | string }) {
  return icon === 'mascot' ? <PinocchioIcon size={size ?? '1em'} /> : <>{icon}</>;
}
