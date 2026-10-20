interface Props {
  light?: boolean;
}

export default function Brand({ light = false }: Props) {
  return (
    <a className="corporate-brand" href="https://www.capgemini.com/" target="_blank" rel="noreferrer" aria-label="Capgemini, site oficial (nova janela)">
      <img
        src={`https://www.capgemini.com/wp-content/themes/capgemini2025/assets/images/capgemini${light ? 'White' : 'Blue'}.svg`}
        alt="Capgemini"
        width="164"
        height="36"
        referrerPolicy="no-referrer"
      />
    </a>
  );
}
