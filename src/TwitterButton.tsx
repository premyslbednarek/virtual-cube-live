import { Button, ButtonProps } from '@mantine/core';

export function TwitterButton(props: ButtonProps & React.ComponentPropsWithoutRef<'button'>) {
  return (
    <Button
      variant="default"
      {...props}
    />
  );
}