"use client";

import {
  AdventureV8BootstrapShell,
  AdventureV8Experience,
  type AdventureV8ExperienceProps,
} from "../v8/AdventureV8Experience";
import styles from "./configurator-v9.module.css";

type Props = Omit<AdventureV8ExperienceProps, "uiVersion">;

export function AdventureV9BootstrapShell() {
  return (
    <div className={styles.theme} data-adventure-v9-theme="solid">
      <AdventureV8BootstrapShell uiVersion="v9" />
    </div>
  );
}

export function AdventureV9Experience(props: Props) {
  return (
    <div className={styles.theme} data-adventure-v9-theme="solid">
      <AdventureV8Experience {...props} uiVersion="v9" />
    </div>
  );
}
