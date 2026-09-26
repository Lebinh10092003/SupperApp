import type { SVGProps } from 'react';

/**
 * antd-mobile-icons không có icon "trường học" — tự vẽ 1 icon mũ tốt
 * nghiệp đơn giản, đúng quy ước hiển thị của antd-mobile-icons (viewBox
 * 0 0 48 48, currentColor, cỡ 1em) để dùng lẫn được với bộ icon còn lại.
 */
export function SchoolOutline(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      style={{ verticalAlign: '-0.125em', ...props.style }}
    >
      <path
        fill="currentColor"
        d="M24 6 3 15.5 24 25l16.5-7.5V30h3V15.5L24 6Zm0 3.3 13.8 6.2L24 21.7l-13.8-6.2L24 9.3ZM9 20.9l12.3 5.6a5 5 0 0 0 5.4 0L39 20.9v6.4c0 4.4-6.7 9.3-15 9.3S9 31.7 9 27.3v-6.4Z"
      />
    </svg>
  );
}
